-- ==============================================================================
-- SCHOLAVON — Migration V4: Paystack Subscription & Payment Events
-- ==============================================================================
-- Run this in your Supabase SQL Editor AFTER all previous migrations.
-- Safe to run multiple times (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- https://supabase.com/dashboard/project/zfxkmwdvvjwugixtmpml/sql/new
-- ==============================================================================

-- ─── 1. ADD subscription_status TO public.users (fast-read denormalized field) ─
-- This column is the fast read path for frontend feature-gating.
-- It is ONLY written by the server-side webhook handler via service-role.
-- Students cannot write to it directly (RLS SELECT/UPDATE policies unchanged).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'premium', 'cancelled', 'past_due'));

-- ─── 2. CREATE public.subscriptions ──────────────────────────────────────────
-- Authoritative subscription record, one per user.
-- All writes from server-side (webhook) via Supabase service-role key.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL,
    -- 'premium_monthly' | 'premium_annual'
  status                  TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due', 'trialing')),
  paystack_customer_code  TEXT,
    -- e.g. CUS_xxxxxxxxxxxxxxx
  paystack_subscription_code TEXT,
    -- e.g. SUB_xxxxxxxxxxxxxxx
  paystack_email_token    TEXT,
    -- token used by Paystack to send subscription management link emails
  paystack_plan_code      TEXT,
    -- Paystack plan code (PLN_xxxxxxx) — never sent to frontend
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  next_payment_date       TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
    -- one subscription row per user; upserted on each event
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- ─── 3. CREATE public.payment_events ─────────────────────────────────────────
-- Immutable audit log of every Paystack webhook event received.
-- Idempotency key: (paystack_reference, event_type) — only processed once.

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL,
    -- Paystack event name e.g. 'charge.success', 'subscription.create'
  paystack_reference TEXT,
    -- Paystack transaction reference
  paystack_sub_code TEXT,
    -- Paystack subscription code (for subscription events)
  amount_kobo       BIGINT,
    -- Amount in kobo (1 NGN = 100 kobo). Never in naira.
  currency          TEXT DEFAULT 'NGN',
  plan_id           TEXT,
    -- Our internal plan id: 'premium_monthly' | 'premium_annual'
  raw_payload       JSONB,
    -- Complete Paystack webhook payload — for audit/replay
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for idempotency: prevents processing the same event twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_ref_type
  ON public.payment_events (paystack_reference, event_type)
  WHERE paystack_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON public.payment_events(event_type);

-- ─── 4. ROW LEVEL SECURITY ───────────────────────────────────────────────────

-- subscriptions: Students may read only their own row.
-- NO student INSERT or UPDATE — only service_role (webhook handler) writes.
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own subscription" ON public.subscriptions;
CREATE POLICY "Students read own subscription" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- payment_events: No client access at all.
-- Only service_role (webhook handler) can insert/read.
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to payment_events" ON public.payment_events;
CREATE POLICY "No client access to payment_events" ON public.payment_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Admins read payment events" ON public.payment_events;
CREATE POLICY "Admins read payment events" ON public.payment_events
  FOR SELECT USING (public.is_admin());

-- ─── 5. VERIFY: subscription_status is readable by own user (already covered) ─
-- The existing "Users can read own profile" policy on public.users covers this.
-- The existing "Users can update own profile" policy explicitly cannot be used
-- to update subscription_status because the webhook handler uses service_role.
-- No additional policy changes needed for public.users.

-- ─── DONE ────────────────────────────────────────────────────────────────────
-- After running this migration:
--
-- public.users gains:       subscription_status (TEXT, default 'free')
-- New table:                public.subscriptions  (authoritative subscription record)
-- New table:                public.payment_events (immutable audit log)
--
-- Paystack webhook flow:
--   1. Webhook hits POST /api/v1/payments/webhook (Railway backend)
--   2. Backend verifies HMAC-SHA512 signature using PAYSTACK_SECRET_KEY
--   3. Backend checks payment_events for idempotency (ref + event_type unique)
--   4. Backend upserts public.subscriptions via Supabase service-role client
--   5. Backend updates public.users.subscription_status via service-role client
--   6. Frontend reads subscription_status from public.users on next auth refresh
-- ==============================================================================
