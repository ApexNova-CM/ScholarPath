/**
 * payments.ts — Paystack payment routes for Scholavon
 *
 * SECURITY CONTRACT:
 *  - /initialize : authenticated students only; amount derived server-side ONLY.
 *  - /verify     : authenticated; re-verifies with Paystack before any DB write.
 *  - /webhook    : public (Paystack hits it); signature verified before ANY processing.
 *  - Supabase writes go through service-role client to bypass RLS securely.
 *  - Webhook processing is idempotent (unique index on paystack_reference + event_type).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  InitializePaymentSchema,
  PLAN_DEFINITIONS,
  SubscriptionPlanId,
} from '../types';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyWebhookSignature,
  resolvePlanIdFromPaystack,
} from '../services/paystackService';

const router = Router();

// ─── Supabase service-role client (server-only, bypasses RLS) ────────────────
// Created lazily so startup doesn't fail when env vars aren't configured yet
function getServiceClient() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for payment processing.'
    );
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Helper: upsert subscription + update user status in Supabase ─────────────
async function activateUserSubscription(
  userId: string,
  planId: SubscriptionPlanId,
  paystackData: {
    customerCode?: string;
    subscriptionCode?: string;
    emailToken?: string;
    planCode?: string;
    periodStart?: string;
    periodEnd?: string;
    nextPaymentDate?: string;
  }
): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // 1. Upsert the subscription row (authoritative record)
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        status: 'active',
        paystack_customer_code: paystackData.customerCode,
        paystack_subscription_code: paystackData.subscriptionCode,
        paystack_email_token: paystackData.emailToken,
        paystack_plan_code: paystackData.planCode,
        current_period_start: paystackData.periodStart || now,
        current_period_end: paystackData.periodEnd,
        next_payment_date: paystackData.nextPaymentDate,
        cancelled_at: null,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );

  if (subError) {
    console.error('[payments] Supabase subscription upsert error:', subError.message);
    throw new Error(`Subscription upsert failed: ${subError.message}`);
  }

  // 2. Update the fast-read denormalized field on users
  const { error: userError } = await supabase
    .from('users')
    .update({ subscription_status: 'premium', updated_at: now })
    .eq('id', userId);

  if (userError) {
    console.error('[payments] Supabase user status update error:', userError.message);
    // Don't throw — subscription row was written; status will be inferred on next read
  }
}

async function cancelUserSubscription(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('user_id', userId);

  await supabase
    .from('users')
    .update({ subscription_status: 'cancelled', updated_at: now })
    .eq('id', userId);
}

async function setUserPastDue(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: now })
    .eq('user_id', userId);

  await supabase
    .from('users')
    .update({ subscription_status: 'past_due', updated_at: now })
    .eq('id', userId);
}

// ─── Helper: record a payment event (idempotent via unique index) ─────────────
async function recordPaymentEvent(event: {
  userId?: string;
  eventType: string;
  paystackReference?: string;
  paystackSubCode?: string;
  amountKobo?: number;
  currency?: string;
  planId?: string;
  rawPayload: unknown;
}): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase.from('payment_events').insert({
    user_id: event.userId || null,
    event_type: event.eventType,
    paystack_reference: event.paystackReference || null,
    paystack_sub_code: event.paystackSubCode || null,
    amount_kobo: event.amountKobo ?? null,
    currency: event.currency || 'NGN',
    plan_id: event.planId || null,
    raw_payload: event.rawPayload,
    processed_at: new Date().toISOString(),
  });

  if (error) {
    // Unique constraint violation means we already processed this event
    if (error.code === '23505') {
      console.log(
        `[payments] Duplicate event ignored: ${event.eventType} / ${event.paystackReference}`
      );
      return false; // Not an error — idempotent
    }
    console.error('[payments] Failed to record payment event:', error.message);
    return false;
  }

  return true; // Successfully recorded (first time)
}

// ─── Helper: resolve userId from Supabase by Paystack customer code ───────────
async function findUserByPaystackCustomer(
  customerCode: string
): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('paystack_customer_code', customerCode)
    .maybeSingle();

  if (error || !data) return null;
  return data.user_id as string;
}

// =============================================================================
// POST /api/v1/payments/initialize
// Authenticated student only. Initializes a Paystack transaction for a plan.
// Amount is derived server-side from planId — NEVER from client body.
// =============================================================================
router.post(
  '/initialize',
  authenticateToken,
  requireRole('student'),
  validateBody(InitializePaymentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const email = req.user!.email;
      const { planId } = req.body as { planId: SubscriptionPlanId };

      const plan = PLAN_DEFINITIONS[planId];
      if (!plan) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PLAN', message: 'Invalid plan selected.' },
        });
        return;
      }

      if (!config.paystackSecretKey) {
        res.status(503).json({
          success: false,
          error: { code: 'PAYMENT_UNAVAILABLE', message: 'Payment service is not configured.' },
        });
        return;
      }

      const initData = await initializePaystackTransaction(email, userId, planId);

      res.json({
        success: true,
        data: {
          authorizationUrl: initData.authorization_url,
          reference: initData.reference,
          plan: {
            id: plan.id,
            name: plan.name,
            amountNaira: plan.amountKobo / 100,
            currency: plan.currency,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// GET /api/v1/payments/verify?reference=<ref>
// Authenticated user. Verifies a Paystack transaction reference server-side.
// Called by the frontend callback page — never trusts client-asserted success.
// =============================================================================
router.get(
  '/verify',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reference = req.query.reference as string;
      const userId = req.user!.id;

      if (!reference || typeof reference !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_REFERENCE', message: 'Transaction reference is required.' },
        });
        return;
      }

      const txData = await verifyPaystackTransaction(reference);

      if (txData.status !== 'success') {
        res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_NOT_SUCCESSFUL',
            message: `Payment status is '${txData.status}'. Only successful payments activate Plus.`,
          },
        });
        return;
      }

      // Security: Confirm the user in metadata matches the authenticated user.
      // This prevents one user from verifying another user's payment.
      const metaUserId = txData.metadata?.scholavon_user_id;
      if (metaUserId && metaUserId !== userId) {
        console.warn(
          `[payments] verify: metadata userId ${metaUserId} ≠ authenticated userId ${userId}`
        );
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Transaction does not belong to this account.' },
        });
        return;
      }

      // Resolve plan from metadata or Paystack plan object
      const planId = (txData.metadata?.plan_id as SubscriptionPlanId | undefined)
        ?? resolvePlanIdFromPaystack(
          txData.plan_object?.plan_code,
          txData.amount
        )
        ?? 'premium_monthly';

      // Record event (idempotent — safe to call even if webhook already fired)
      await recordPaymentEvent({
        userId,
        eventType: 'charge.success.verify',
        paystackReference: reference,
        amountKobo: txData.amount,
        currency: txData.currency,
        planId,
        rawPayload: txData as unknown,
      });

      // Activate subscription in Supabase
      await activateUserSubscription(userId, planId, {
        customerCode: txData.customer?.customer_code,
        subscriptionCode: txData.subscription?.subscription_code,
        emailToken: txData.subscription?.email_token,
        nextPaymentDate: txData.subscription?.next_payment_date,
      });

      res.json({
        success: true,
        data: {
          status: 'active',
          planId,
          message: 'Payment verified. Scholavon Plus is now active on your account.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// POST /api/v1/payments/webhook
// PUBLIC endpoint — Paystack posts here after payment events.
//
// CRITICAL: This route must receive the RAW body (not parsed JSON) so the
// HMAC-SHA512 signature can be verified. See server/src/index.ts for how
// express.raw() is applied selectively to this route BEFORE express.json().
// =============================================================================
router.post(
  '/webhook',
  async (req: Request, res: Response): Promise<void> => {
    const rawBody: Buffer = req.body;

    // ── 1. Verify Paystack signature ───────────────────────────────────────
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[payments] Webhook rejected: invalid signature');
      res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    // ── 2. Parse the raw body ──────────────────────────────────────────────
    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      res.status(400).json({ success: false, error: 'Invalid JSON payload' });
      return;
    }

    const eventType: string = event?.event || 'unknown';
    const data = event?.data || {};

    // ── 3. Respond to Paystack immediately (before processing) ────────────
    // Paystack requires a 200 response quickly; processing happens after.
    res.status(200).json({ success: true });

    // ── 4. Process the event asynchronously ───────────────────────────────
    try {
      await handleWebhookEvent(eventType, data, event);
    } catch (err) {
      console.error('[payments] Webhook processing error:', err);
      // Don't re-throw — response already sent to Paystack
    }
  }
);

// =============================================================================
// handleWebhookEvent — process each Paystack event type
// =============================================================================
async function handleWebhookEvent(
  eventType: string,
  data: any,
  rawEvent: unknown
): Promise<void> {
  const reference: string | undefined = data?.reference;
  const subCode: string | undefined = data?.subscription_code;
  const customerCode: string | undefined = data?.customer?.customer_code;
  const amountKobo: number | undefined = data?.amount;
  const currency: string = data?.currency || 'NGN';

  // Resolve user: prefer metadata.scholavon_user_id, then look up by customer code
  let userId: string | undefined =
    data?.metadata?.scholavon_user_id ||
    data?.metadata?.custom_fields?.find((f: any) => f.variable_name === 'scholavon_user_id')?.value;

  if (!userId && customerCode) {
    const found = await findUserByPaystackCustomer(customerCode);
    if (found) userId = found;
  }

  // Resolve plan
  const metaPlanId = data?.metadata?.plan_id as SubscriptionPlanId | undefined;
  const planCode: string | undefined = data?.plan?.plan_code || data?.plan_object?.plan_code;
  const resolvedPlanId: SubscriptionPlanId =
    metaPlanId ?? resolvePlanIdFromPaystack(planCode, amountKobo) ?? 'premium_monthly';

  // ── Record the event (idempotent) ─────────────────────────────────────────
  const isNew = await recordPaymentEvent({
    userId,
    eventType,
    paystackReference: reference,
    paystackSubCode: subCode,
    amountKobo,
    currency,
    planId: resolvedPlanId,
    rawPayload: rawEvent,
  });

  // If isNew = false, this event was already processed — skip DB writes
  if (!isNew) return;

  console.log(`[payments] Processing webhook: ${eventType} | userId: ${userId || 'unknown'}`);

  // ── Handle each event type ────────────────────────────────────────────────
  switch (eventType) {
    // Successful one-time charge or first subscription payment
    case 'charge.success': {
      if (!userId) {
        console.warn('[payments] charge.success: no userId resolved, skipping activation');
        break;
      }
      await activateUserSubscription(userId, resolvedPlanId, {
        customerCode,
        subscriptionCode: subCode || data?.subscription?.subscription_code,
        emailToken: data?.subscription?.email_token,
        planCode,
        periodStart: new Date().toISOString(),
        nextPaymentDate: data?.subscription?.next_payment_date,
      });
      console.log(`[payments] ✓ charge.success → activated Plus for userId: ${userId}`);
      break;
    }

    // Paystack subscription created (recurring plan setup)
    case 'subscription.create': {
      if (!userId) {
        console.warn('[payments] subscription.create: no userId resolved, skipping');
        break;
      }
      await activateUserSubscription(userId, resolvedPlanId, {
        customerCode,
        subscriptionCode: data?.subscription_code,
        emailToken: data?.email_token,
        planCode,
        periodStart: new Date().toISOString(),
        nextPaymentDate: data?.next_payment_date,
      });
      console.log(`[payments] ✓ subscription.create → activated Plus for userId: ${userId}`);
      break;
    }

    // Recurring invoice paid successfully
    case 'invoice.payment_success': {
      if (!userId) break;
      await activateUserSubscription(userId, resolvedPlanId, {
        customerCode,
        subscriptionCode: subCode,
        nextPaymentDate: data?.next_payment_date,
      });
      console.log(`[payments] ✓ invoice.payment_success → renewed Plus for userId: ${userId}`);
      break;
    }

    // Subscription disabled/cancelled (by user, admin, or failed payment threshold)
    case 'subscription.disable': {
      if (!userId) {
        // Look up via subscription code in our DB
        if (subCode) {
          const supabase = getServiceClient();
          const { data: row } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('paystack_subscription_code', subCode)
            .maybeSingle();
          if (row?.user_id) userId = row.user_id;
        }
      }
      if (userId) {
        await cancelUserSubscription(userId);
        console.log(`[payments] ✓ subscription.disable → cancelled Plus for userId: ${userId}`);
      }
      break;
    }

    // Recurring invoice payment failed
    case 'invoice.payment_failed': {
      if (!userId) {
        if (subCode) {
          const supabase = getServiceClient();
          const { data: row } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('paystack_subscription_code', subCode)
            .maybeSingle();
          if (row?.user_id) userId = row.user_id;
        }
      }
      if (userId) {
        await setUserPastDue(userId);
        console.log(`[payments] ✓ invoice.payment_failed → set past_due for userId: ${userId}`);
      }
      break;
    }

    default:
      console.log(`[payments] Unhandled event type: ${eventType} (logged only)`);
  }
}

// =============================================================================
// GET /api/v1/payments/status
// Authenticated student — returns their current subscription status.
// =============================================================================
router.get(
  '/status',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_id, status, current_period_end, next_payment_date, cancelled_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw new Error(error.message);

      res.json({
        success: true,
        data: data
          ? {
              planId: data.plan_id,
              status: data.status,
              currentPeriodEnd: data.current_period_end,
              nextPaymentDate: data.next_payment_date,
              cancelledAt: data.cancelled_at,
            }
          : { status: 'free' },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
