-- ==============================================================================
-- SCHOLAVON — Supabase Migration v7: Multi-Audience Foundation
-- Motto: "Opportunities Within Reach"
-- ==============================================================================
-- STATUS: PREPARED FOR REVIEW ONLY — DO NOT EXECUTE AUTOMATICALLY
--
-- This migration extends Scholavon to support learners and early-career talent
-- across multiple education stages and opportunity types without breaking
-- existing student accounts, scholarships, or security policies.
--
-- Supported Applicant Stages:
--   - 'secondary'     : Secondary school / high school learners
--   - 'undergraduate' : University, polytechnic, college undergraduates
--   - 'postgraduate'  : Masters, PhD, postdoctoral researchers
--   - 'vocational'    : TVET, technical, vocational, apprentices
--   - 'early_career'  : Recent graduates, early-career jobseekers
--
-- Supported Opportunity Types:
--   - 'scholarship'   : Traditional scholarships & tuition awards
--   - 'grant'         : Grants & financial bursaries
--   - 'fellowship'    : Research & leadership fellowships
--   - 'internship'    : Paid & academic internships
--   - 'apprenticeship': Technical & trade apprenticeships
--   - 'competition'   : Competitions, hackathons, academic challenges
--   - 'exchange'      : Exchange & study-abroad programmes
-- ==============================================================================

-- 1. USERS PROFILE EXTENSIONS (public.users)
-- Add non-university and stage-specific fields with safe backward-compatible defaults.
-- Existing role constraint (CHECK role IN ('student', 'admin')) remains strictly untouched.
-- applicant_stage is intentionally nullable: legacy users receive NULL and must explicitly
-- choose their stage through the updated profile UI. PostgreSQL CHECK constraints pass
-- silently on NULL, so existing rows will not violate users_applicant_stage_check.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS applicant_stage TEXT,
  ADD COLUMN IF NOT EXISTS secondary_school_name TEXT,
  ADD COLUMN IF NOT EXISTS secondary_graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS target_major TEXT,
  ADD COLUMN IF NOT EXISTS trade_specialization TEXT,
  ADD COLUMN IF NOT EXISTS trade_certifications TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_industry TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT;

-- Constraint for applicant_stage to ensure clean data validation while allowing NULL for legacy rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_applicant_stage_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_applicant_stage_check
      CHECK (applicant_stage IN ('secondary', 'undergraduate', 'postgraduate', 'vocational', 'early_career'));
  END IF;
END $$;

-- Index for querying users by stage
CREATE INDEX IF NOT EXISTS idx_users_applicant_stage ON public.users(applicant_stage);


-- 2. SCHOLARSHIPS / OPPORTUNITIES EXTENSIONS (public.scholarships)
-- Add opportunity taxonomy and multi-audience targeting.
-- Default opportunity_type is 'scholarship' to ensure 100% backward compatibility for all existing rows.
ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS opportunity_type TEXT DEFAULT 'scholarship',
  ADD COLUMN IF NOT EXISTS target_audiences TEXT[] DEFAULT '{"undergraduate"}',
  ADD COLUMN IF NOT EXISTS compensation_type TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS skills_required TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS workplace_type TEXT DEFAULT 'unspecified';

-- Constraint for opportunity_type to maintain data integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scholarships_opportunity_type_check'
  ) THEN
    ALTER TABLE public.scholarships
      ADD CONSTRAINT scholarships_opportunity_type_check
      CHECK (opportunity_type IN (
        'scholarship',
        'grant',
        'fellowship',
        'internship',
        'apprenticeship',
        'competition',
        'exchange'
      ));
  END IF;
END $$;

-- Constraint for workplace_type to enforce data integrity.
-- The DEFAULT 'unspecified' is a permitted value in this constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scholarships_workplace_type_check'
  ) THEN
    ALTER TABLE public.scholarships
      ADD CONSTRAINT scholarships_workplace_type_check
      CHECK (workplace_type IN ('remote', 'on_site', 'hybrid', 'unspecified'));
  END IF;
END $$;

-- Indexes for performance when filtering opportunities by type and target audience
CREATE INDEX IF NOT EXISTS idx_scholarships_opportunity_type ON public.scholarships(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_scholarships_target_audiences ON public.scholarships USING GIN(target_audiences);
