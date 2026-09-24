-- ==============================================================================
-- SCHOLAR PATH — Migration V3: Admin Account Persistence Fix
-- ==============================================================================
-- Run this in your Supabase SQL Editor AFTER supabase_schema_and_policies.sql
-- Safe to run multiple times (uses DROP POLICY IF EXISTS / CREATE OR REPLACE)
-- ==============================================================================

-- ─── 1. ENSURE existing admins already in auth.users get a profile row ────────
-- If you have real Supabase Auth users (e.g. miraclemgbemena2007@gmail.com)
-- whose IDs are in auth.users but NOT in public.users, insert them now.
-- Replace the UUIDs below with the real auth.users UUIDs from your Supabase dashboard.
--
-- Example (comment out if not needed):
-- INSERT INTO public.users (id, email, role, first_name, last_name, country,
--   education_level, institution, field_of_study, gpa, gpa_scale, profile_completion)
-- VALUES
--   ('<REPLACE_WITH_REAL_AUTH_UUID>', 'miraclemgbemena2007@gmail.com', 'admin',
--    'Miracle', 'Mgbemena', 'Nigeria', 'Postgraduate (Masters)',
--    'ScholarPath Foundation', 'Platform Administration', 4.0, 4.0, 100),
--   ('<REPLACE_WITH_REAL_AUTH_UUID>', 'chrisekpe18@gmail.com', 'admin',
--    'Chris', 'Ekpe', 'Nigeria', 'Postgraduate (Masters)',
--    'ScholarPath Foundation', 'Scholarship Operations', 4.0, 4.0, 100)
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';


-- ─── 2. FIX: Allow authenticated users & admins to INSERT profile rows ─────────
-- The existing policy allows insert only when id = auth.uid() OR service_role.
-- supabase.auth.signUp creates the auth user, then an admin or new user calls
-- supabase.from('users').upsert(...) — this must be allowed for admins creating users.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ─── 3. FIX: Allow admins to update any user's profile/role ──────────────────
-- An existing admin needs to be able to edit user profiles or demote another admin to 'student'
-- (this is the delete-admin action in AdminAdminsPage).

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (
    id = auth.uid() OR public.is_admin()
  );

-- ─── 4. ENSURE: is_admin() helper is up to date ───────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── 5. TRIGGER: Auto-create a public.users row when auth.users row is created ─
-- This runs as SECURITY DEFINER (service_role) so it bypasses RLS.
-- Reads role from user_metadata (defaulting to 'student' if omitted).

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
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
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
    CASE WHEN (NEW.raw_user_meta_data->>'role') = 'admin' THEN 'ScholarPath Foundation' ELSE '' END,
    COALESCE(NEW.raw_user_meta_data->>'assigned_department', ''),
    4.0,
    4.0,
    100
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
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

-- ─── 6. VERIFY RLS is enabled ────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ─── DONE ─────────────────────────────────────────────────────────────────────
-- After running this migration, the complete admin persistence flow works as:
--
--  Create admin:
--    1. tempAuthClient.auth.signUp(email, password, { data: { role: 'admin', ... } }) → auth.users row created
--    2. DB trigger fires                                → public.users row (role='admin')
--    3. supabase.from('users').upsert({ role:'admin' }) → row updated/verified in public.users
--    4. Admin can log in and session persists permanently
--
--  Admin login:
--    1. supabase.auth.signInWithPassword(email, password)
--    2. AuthContext fetches public.users WHERE id = auth.uid()
--    3. role = 'admin' → admin dashboard accessible
--    4. Supabase browser session storage keeps session alive across refreshes/restarts
--
--  Student cannot access admin:
--    role from DB is 'student' → App.tsx guard blocks all /admin/* routes
-- ==============================================================================

