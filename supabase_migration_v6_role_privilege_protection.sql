-- ==============================================================================
-- SCHOLAVON — Migration V6: Role & Subscription Privilege Protection (BUG-02 Fix)
-- ==============================================================================
-- Run this in your Supabase SQL Editor AFTER all previous migrations (V1 - V5).
-- Safe to run multiple times (uses DROP POLICY IF EXISTS / CREATE OR REPLACE).
-- https://supabase.com/dashboard/project/zfxkmwdvvjwugixtmpml/sql/new
-- ==============================================================================

-- ─── 1. CONTEXT HELPER: is_service_or_superuser() ─────────────────────────────
-- Accurately identifies whether execution is running with Supabase service_role,
-- PostgreSQL superuser, or internal supabase_admin privileges.
-- Does NOT rely solely on client JWT strings; checks execution context.
CREATE OR REPLACE FUNCTION public.is_service_or_superuser()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Direct database superuser or Supabase administrative context
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN TRUE;
  END IF;

  -- PostgREST service_role context
  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- JWT service_role claim verification
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ─── 2. ADMIN HELPER: is_admin() ──────────────────────────────────────────────
-- Safe, stable, non-recursive check for administrator privilege.
-- Runs with search_path = public and SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Service role or database superuser is always privileged
  IF public.is_service_or_superuser() THEN
    RETURN TRUE;
  END IF;

  -- Unauthenticated callers cannot be admins
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Authoritative database lookup in public.users
  SELECT role INTO v_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN (v_role = 'admin');
END;
$$;

-- ─── 3. SIGNUP TRIGGER: handle_new_auth_user() ───────────────────────────────
-- Fix for Vector A: Ordinary signups ALWAYS default to role = 'student'
-- and subscription_status = 'free'.
-- raw_user_meta_data->>'role' is client-controlled and NEVER trusted.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    role,
    subscription_status,
    first_name,
    last_name,
    country,
    education_level,
    institution,
    field_of_study,
    gpa,
    gpa_scale,
    profile_completion
  )
  VALUES (
    NEW.id,
    NEW.email,
    'student', -- Always safe default: never trust client metadata for privileged roles
    'free',    -- Always safe default: subscription only updated via verified webhook
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1),
      'User'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2), ''),
      ''
    ),
    'International',
    'Undergraduate',
    '',
    COALESCE(NEW.raw_user_meta_data->>'assigned_department', ''),
    4.0,
    4.0,
    100
  )
  ON CONFLICT (id) DO UPDATE SET
    -- On conflict, preserve existing role and subscription_status; only update basic profile fields
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    field_of_study = EXCLUDED.field_of_study;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── 4. PRIVILEGE ENFORCEMENT TRIGGER: protect_user_privileged_fields() ───────
-- Fix for Vector B: Database-level enforcement on public.users.
-- Prevents unauthorized alteration of 'role' and 'subscription_status'.
-- Preserves last-active-admin safeguard and Paystack webhook processing.
CREATE OR REPLACE FUNCTION public.protect_user_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service BOOLEAN;
  v_is_admin_user BOOLEAN;
  v_admin_count INTEGER;
BEGIN
  v_is_service := public.is_service_or_superuser();
  v_is_admin_user := public.is_admin();

  -- ─── INSERT OPERATION ────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    -- Only service_role or active admins can create users with privileged fields
    IF NOT (v_is_service OR v_is_admin_user) THEN
      NEW.role := 'student';
      NEW.subscription_status := 'free';
    END IF;
    RETURN NEW;
  END IF;

  -- ─── UPDATE OPERATION ────────────────────────────────────────────────────────
  IF TG_OP = 'UPDATE' THEN
    -- Case 1: Service role (Paystack webhook handler, backend cron, system scripts)
    -- Permitted to update all fields, including subscription_status and role.
    IF v_is_service THEN
      RETURN NEW;
    END IF;

    -- Case 2: Active Administrator (AdminAdminsPage / promoteUserToAdmin)
    IF v_is_admin_user THEN
      -- Safeguard: If demoting an admin to student, ensure at least one OTHER admin remains
      IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
        SELECT count(*) INTO v_admin_count
        FROM public.users
        WHERE role = 'admin' AND id != OLD.id;

        IF v_admin_count < 1 THEN
          RAISE EXCEPTION 'CANNOT_REMOVE_LAST_ADMIN: Cannot revoke privileges; at least one administrator must remain active.'
            USING ERRCODE = '23514';
        END IF;
      END IF;

      -- Admins cannot modify subscription_status directly from client queries
      -- (Subscriptions must flow through verified Paystack service_role webhook)
      IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
        NEW.subscription_status := OLD.subscription_status;
      END IF;

      RETURN NEW;
    END IF;

    -- Case 3: Regular Student / Non-admin user updating own profile
    -- Strictly prohibit unauthorized changes to role or subscription_status
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROLE_CHANGE: Ordinary users cannot modify their account role.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
      RAISE EXCEPTION 'UNAUTHORIZED_SUBSCRIPTION_CHANGE: Subscription status can only be modified through verified payment processing.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_privileged_fields ON public.users;
CREATE TRIGGER trg_protect_user_privileged_fields
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_fields();

-- ─── 5. ROW LEVEL SECURITY POLICIES ON public.users ───────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5.1 SELECT Policy: Users read own profile; Admins read all profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_service_or_superuser()
  );

-- 5.2 INSERT Policy: Non-admins can only insert their own row as student & free
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (
    public.is_service_or_superuser()
    OR public.is_admin()
    OR (
      id = auth.uid()
      AND role = 'student'
      AND subscription_status = 'free'
    )
  );

-- 5.3 UPDATE Policy: Non-admins can only update their own row and cannot set admin
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (
    public.is_service_or_superuser()
    OR public.is_admin()
    OR id = auth.uid()
  )
  WITH CHECK (
    public.is_service_or_superuser()
    OR public.is_admin()
    OR (
      id = auth.uid()
      AND role = 'student'
    )
  );

-- ==============================================================================
-- DONE: Migration V6 complete.
-- ordinary signup metadata is ignored for roles;
-- RLS and triggers strictly block student self-promotion to admin;
-- subscription_status can only be altered by verified service_role webhooks;
-- legitimate admin promotion and last-admin safeguards are guaranteed.
-- ==============================================================================
