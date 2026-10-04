/**
 * paystackService.ts
 *
 * Server-side Paystack API wrapper for Scholavon.
 *
 * SECURITY RULES:
 *  - The Paystack secret key (config.paystackSecretKey) NEVER leaves this file.
 *  - This module is NEVER imported by any frontend/Vite code.
 *  - Amounts are ALWAYS in kobo (1 NGN = 100 kobo). Never in naira.
 *  - Plan amounts are defined server-side in PLAN_DEFINITIONS — never trusted from client.
 */

import crypto from 'crypto';
import { config } from '../config';
import { SubscriptionPlanId, PLAN_DEFINITIONS } from '../types';

const PAYSTACK_BASE = 'https://api.paystack.co';

// ─── Internal fetch helper ────────────────────────────────────────────────────
async function paystackRequest<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  if (!config.paystackSecretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
  }

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Paystack returned non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok || json.status === false) {
    const msg = json?.message || `Paystack API error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return json.data as T;
}

// ─── Types returned by Paystack API ──────────────────────────────────────────
export interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyData {
  status: string;              // 'success' | 'failed' | 'abandoned' | etc.
  reference: string;
  amount: number;              // in kobo
  currency: string;
  customer: {
    id: number;
    email: string;
    customer_code: string;
  };
  metadata?: {
    scholavon_user_id?: string;
    plan_id?: string;
    [key: string]: unknown;
  };
  plan_object?: {
    id: number;
    name: string;
    plan_code: string;
    amount: number;
    interval: string;
  };
  subscription?: {
    status: string;
    subscription_code: string;
    email_token: string;
    next_payment_date: string;
  };
}

// ─── Public service functions ─────────────────────────────────────────────────

/**
 * Initialize a Paystack transaction/subscription for the given plan.
 *
 * @param email         The student's email address (from authenticated session, not client input)
 * @param userId        Scholavon user UUID (embedded in metadata for webhook correlation)
 * @param planId        One of 'premium_monthly' | 'premium_annual'
 * @returns             Paystack authorization URL and reference
 */
export async function initializePaystackTransaction(
  email: string,
  userId: string,
  planId: SubscriptionPlanId
): Promise<PaystackInitData> {
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) throw new Error(`Invalid plan ID: ${planId}`);

  // Resolve the Paystack plan code from server config
  const planCode =
    planId === 'premium_monthly'
      ? config.paystackMonthlyPlanCode
      : config.paystackAnnualPlanCode;

  const callbackUrl = `${config.appUrl}/payment/callback`;

  const body: Record<string, unknown> = {
    email,
    amount: plan.amountKobo,
    currency: plan.currency,
    callback_url: callbackUrl,
    metadata: {
      scholavon_user_id: userId,
      plan_id: planId,
      cancel_action: callbackUrl,
    },
  };

  // If a Paystack plan code is configured, attach it for recurring billing
  if (planCode) {
    body.plan = planCode;
  }

  return paystackRequest<PaystackInitData>('POST', '/transaction/initialize', body);
}

/**
 * Verify a Paystack transaction by reference.
 * Always called server-side — never trust the frontend's assertion of success.
 *
 * @param reference  The Paystack transaction reference
 * @returns          Full transaction data from Paystack
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyData> {
  if (!reference || typeof reference !== 'string' || reference.length > 200) {
    throw new Error('Invalid transaction reference');
  }
  return paystackRequest<PaystackVerifyData>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Verify the HMAC-SHA512 signature on an inbound Paystack webhook.
 *
 * Paystack signs the raw request body with the secret key using HMAC-SHA512.
 * The resulting hex digest is sent in the X-Paystack-Signature header.
 *
 * @param rawBody         The raw Buffer of the request body (before JSON parsing)
 * @param signatureHeader The value of req.headers['x-paystack-signature']
 * @returns               true if the signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!config.paystackSecretKey) return false;
  if (!signatureHeader) return false;

  const expectedHash = crypto
    .createHmac('sha512', config.paystackSecretKey)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const receivedBuf = Buffer.from(signatureHeader, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Derive the internal plan ID from a Paystack plan code or transaction amount.
 * Used during webhook processing to map Paystack data back to our plan IDs.
 */
export function resolvePlanIdFromPaystack(
  paystackPlanCode?: string,
  amountKobo?: number
): SubscriptionPlanId | null {
  // Prefer matching by plan code if configured
  if (paystackPlanCode) {
    if (config.paystackMonthlyPlanCode && paystackPlanCode === config.paystackMonthlyPlanCode) {
      return 'premium_monthly';
    }
    if (config.paystackAnnualPlanCode && paystackPlanCode === config.paystackAnnualPlanCode) {
      return 'premium_annual';
    }
  }
  // Fall back to matching by amount
  if (amountKobo === PLAN_DEFINITIONS.premium_monthly.amountKobo) return 'premium_monthly';
  if (amountKobo === PLAN_DEFINITIONS.premium_annual.amountKobo) return 'premium_annual';
  return null;
}
