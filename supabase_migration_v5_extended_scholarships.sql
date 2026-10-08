-- ==============================================================================
-- SCHOLAVON — Supabase Migration v5: Extended Scholarship Auditing & Fields
-- ==============================================================================
-- Run this in your Supabase SQL Editor to support the upgraded scholarship data model:
-- https://supabase.com/dashboard/project/zfxkmwdvvjwugixtmpml/sql/new
-- ==============================================================================

ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS scholarship_type TEXT,
  ADD COLUMN IF NOT EXISTS award_currency TEXT,
  ADD COLUMN IF NOT EXISTS award_type TEXT,
  ADD COLUMN IF NOT EXISTS award_frequency TEXT,
  ADD COLUMN IF NOT EXISTS award_value_text TEXT,
  ADD COLUMN IF NOT EXISTS award_description TEXT,
  ADD COLUMN IF NOT EXISTS amount_period TEXT,
  ADD COLUMN IF NOT EXISTS amount_display TEXT,
  ADD COLUMN IF NOT EXISTS what_the_award_covers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS number_of_recipients TEXT,

  ADD COLUMN IF NOT EXISTS eligible_nationalities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country_of_study TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS institution_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS study_years TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligible_courses TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS academic_standing TEXT,
  ADD COLUMN IF NOT EXISTS leadership_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS community_service_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disability_applicable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS membership_requirement TEXT,
  ADD COLUMN IF NOT EXISTS other_eligibility_conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS other_requirements_notes TEXT,

  ADD COLUMN IF NOT EXISTS structured_requirements JSONB DEFAULT '[]'::jsonb,

  ADD COLUMN IF NOT EXISTS application_method TEXT,
  ADD COLUMN IF NOT EXISTS official_website_url TEXT,
  ADD COLUMN IF NOT EXISTS application_fee TEXT,
  ADD COLUMN IF NOT EXISTS application_fee_currency TEXT,
  ADD COLUMN IF NOT EXISTS account_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS application_steps JSONB DEFAULT '[]'::jsonb,

  ADD COLUMN IF NOT EXISTS deadline_time TEXT,
  ADD COLUMN IF NOT EXISTS award_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT,

  ADD COLUMN IF NOT EXISTS selection_process TEXT,
  ADD COLUMN IF NOT EXISTS selection_criteria TEXT,
  ADD COLUMN IF NOT EXISTS test_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interview_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS essay_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shortlisting_process TEXT,
  ADD COLUMN IF NOT EXISTS selection_steps JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_selection_info TEXT,

  ADD COLUMN IF NOT EXISTS official_source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_close_on_deadline BOOLEAN DEFAULT TRUE;

-- Update status check constraint if needed to permit 'active'/'draft'/'closed'
ALTER TABLE public.scholarships DROP CONSTRAINT IF EXISTS scholarships_status_check;
ALTER TABLE public.scholarships ADD CONSTRAINT scholarships_status_check 
  CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'expired', 'closed', 'archived', 'active'));
