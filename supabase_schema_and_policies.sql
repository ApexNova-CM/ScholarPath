-- ==============================================================================
-- SCHOLAR PATH — Production Supabase Schema, Row-Level Security (RLS) & Seed
-- ==============================================================================
-- Run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zfxkmwdvvjwugixtmpml/sql/new
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CREATE / VERIFY TABLES
-- ------------------------------------------------------------------------------

-- Users Profile
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  date_of_birth TIMESTAMPTZ,
  country TEXT NOT NULL DEFAULT 'International',
  state TEXT,
  city TEXT,
  education_level TEXT NOT NULL DEFAULT 'Undergraduate',
  institution TEXT NOT NULL DEFAULT '',
  field_of_study TEXT NOT NULL DEFAULT '',
  course TEXT,
  year_level TEXT,
  graduation_year INTEGER,
  gpa NUMERIC(4, 2) NOT NULL DEFAULT 0.0,
  gpa_scale NUMERIC(3, 1) NOT NULL DEFAULT 4.0,
  financial_need BOOLEAN DEFAULT FALSE,
  gender TEXT,
  awards TEXT[] DEFAULT '{}',
  achievements TEXT[] DEFAULT '{}',
  extracurriculars TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  leadership TEXT[] DEFAULT '{}',
  volunteering TEXT[] DEFAULT '{}',
  work_experience TEXT[] DEFAULT '{}',
  profile_completion INTEGER NOT NULL DEFAULT 0,
  notification_preferences JSONB DEFAULT '{"inApp": true, "email": true, "push": false, "whatsapp": false, "deadlineAlerts": true, "matchingAlerts": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories Taxonomy
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon_name TEXT,
  scholarship_count INTEGER DEFAULT 0
);

-- Providers
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Foundation',
  logo TEXT,
  website TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  country TEXT NOT NULL DEFAULT 'International',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin Users Directory
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Admin' CHECK (role IN ('Super Admin', 'Admin', 'Content Reviewer', 'Verification Officer')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Invited', 'Suspended')),
  assigned_department TEXT DEFAULT 'Operations',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Scholarships
CREATE TABLE IF NOT EXISTS public.scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  provider_logo TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  funding_type TEXT NOT NULL DEFAULT 'Fully funded',
  eligible_countries TEXT[] DEFAULT '{"All"}',
  eligible_states TEXT[],
  education_levels TEXT[] DEFAULT '{"Undergraduate"}',
  fields_of_study TEXT[] DEFAULT '{"All"}',
  minimum_age INTEGER,
  maximum_age INTEGER,
  minimum_gpa NUMERIC(4, 2),
  gpa_scale NUMERIC(3, 1) NOT NULL DEFAULT 4.0,
  gender_requirement TEXT DEFAULT 'Any',
  financial_need_required BOOLEAN DEFAULT FALSE,
  other_requirements TEXT[],
  required_documents TEXT[] DEFAULT '{}',
  application_instructions TEXT NOT NULL DEFAULT '',
  application_url TEXT NOT NULL,
  opening_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  expected_result_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'expired', 'archived')),
  verification_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (verification_status IN ('unverified', 'pending_verification', 'verified', 'rejected', 'changes_requested')),
  verified_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applications Tracker
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  scholarship_title TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'Interested' CHECK (status IN ('Interested', 'Preparing', 'Applied', 'Under Review', 'Interview', 'Successful', 'Unsuccessful', 'Withdrawn', 'Awarded', 'Not Selected')),
  applied_at TIMESTAMPTZ,
  result_date TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  checklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, scholarship_id)
);

-- Saved / Bookmarks
CREATE TABLE IF NOT EXISTS public.saved_scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, scholarship_id)
);

-- Document Locker
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_format TEXT,
  file_size INTEGER,
  size TEXT,
  file_url TEXT,
  download_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'announcement',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  related_scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE SET NULL,
  related_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification Audit Records
CREATE TABLE IF NOT EXISTS public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  scholarship_title TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Helper function with SECURITY DEFINER to check admin role without triggering RLS recursion
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

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Categories (Public Read, Admin Full)
DROP POLICY IF EXISTS "Public categories read" ON public.categories;
CREATE POLICY "Public categories read" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin categories all" ON public.categories;
CREATE POLICY "Admin categories all" ON public.categories FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
);

-- Providers (Public Read, Admin Full)
DROP POLICY IF EXISTS "Public providers read" ON public.providers;
CREATE POLICY "Public providers read" ON public.providers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin providers all" ON public.providers;
CREATE POLICY "Admin providers all" ON public.providers FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
);

-- Scholarships (Public Read Verified, Admin Full)
DROP POLICY IF EXISTS "Public scholarships read" ON public.scholarships;
CREATE POLICY "Public scholarships read" ON public.scholarships FOR SELECT USING (
  status = 'verified' OR public.is_admin()
);

DROP POLICY IF EXISTS "Admin scholarships full" ON public.scholarships;
CREATE POLICY "Admin scholarships full" ON public.scholarships FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
);

-- Users (Student self-management, Admin read all)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (
  id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (
  id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (
  id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role'
);

-- Applications (Students own records, Admin read)
DROP POLICY IF EXISTS "Student applications select" ON public.applications;
CREATE POLICY "Student applications select" ON public.applications FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "Student applications insert" ON public.applications;
CREATE POLICY "Student applications insert" ON public.applications FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Student applications update" ON public.applications;
CREATE POLICY "Student applications update" ON public.applications FOR UPDATE USING (
  user_id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "Student applications delete" ON public.applications;
CREATE POLICY "Student applications delete" ON public.applications FOR DELETE USING (
  user_id = auth.uid()
);

-- Saved Scholarships (Student owns bookmarks)
DROP POLICY IF EXISTS "Student saved select" ON public.saved_scholarships;
CREATE POLICY "Student saved select" ON public.saved_scholarships FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Student saved insert" ON public.saved_scholarships;
CREATE POLICY "Student saved insert" ON public.saved_scholarships FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Student saved delete" ON public.saved_scholarships;
CREATE POLICY "Student saved delete" ON public.saved_scholarships FOR DELETE USING (user_id = auth.uid());

-- Documents Locker (Private to student)
DROP POLICY IF EXISTS "Student documents select" ON public.documents;
CREATE POLICY "Student documents select" ON public.documents FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Student documents insert" ON public.documents;
CREATE POLICY "Student documents insert" ON public.documents FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Student documents update" ON public.documents;
CREATE POLICY "Student documents update" ON public.documents FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Student documents delete" ON public.documents;
CREATE POLICY "Student documents delete" ON public.documents FOR DELETE USING (user_id = auth.uid());

-- Notifications (Private to student)
DROP POLICY IF EXISTS "Student notifications select" ON public.notifications;
CREATE POLICY "Student notifications select" ON public.notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Student notifications update" ON public.notifications;
CREATE POLICY "Student notifications update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Verifications Audit
DROP POLICY IF EXISTS "Public verifications read" ON public.verifications;
CREATE POLICY "Public verifications read" ON public.verifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin verifications insert" ON public.verifications;
CREATE POLICY "Admin verifications insert" ON public.verifications FOR INSERT WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
);

-- Admin Users Directory
DROP POLICY IF EXISTS "Admin users select" ON public.admin_users;
CREATE POLICY "Admin users select" ON public.admin_users FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
);

-- ------------------------------------------------------------------------------
-- 4. INITIAL SEED DATA (Runs with DB Admin privileges)
-- ------------------------------------------------------------------------------

-- Seed Categories
INSERT INTO public.categories (id, name, slug, description)
VALUES 
  ('11111111-1111-4111-a111-111111111111', 'STEM & Tech', 'stem-tech', 'Computer Science, AI, Engineering, Mathematics, and Physical Sciences scholarships.'),
  ('22222222-2222-4222-a222-222222222222', 'Health & Medicine', 'health-medicine', 'Medicine, Biomedical Sciences, Nursing, Public Health, and Global Healthcare awards.'),
  ('33333333-3333-4333-a333-333333333333', 'Business & Finance', 'business-finance', 'Economics, MBA, International Trade, FinTech, and Entrepreneurship funding.'),
  ('44444444-4444-4444-a444-444444444444', 'Arts & Humanities', 'arts-humanities', 'Literature, Philosophy, Visual Arts, History, and Cultural Studies programs.'),
  ('55555555-5555-4555-a555-555555555555', 'Undergraduate', 'undergraduate', 'Bachelor degree scholarships, freshman entry grants, and undergraduate bursaries.'),
  ('66666666-6666-4666-a666-666666666666', 'Postgraduate & PhD', 'postgraduate-phd', 'Masters degrees, doctoral fellowships, and post-doctoral research endowments.'),
  ('77777777-7777-4777-a777-777777777777', 'Law & Public Policy', 'law-public-policy', 'International Relations, Human Rights, Governance, and Legal Studies funding.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed Providers
INSERT INTO public.providers (id, name, type, website, description, contact_email, country, verified)
VALUES
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Bill & Melinda Gates Foundation', 'Global Philanthropic Foundation', 'https://www.gatesfoundation.org', 'Dedicated to fighting poverty, disease, and inequity through education.', 'scholarships@gatesfoundation.org', 'United States', true),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'The Rhodes Trust', 'Endowed Educational Trust', 'https://www.rhodeshouse.ox.ac.uk', 'Brings outstanding international students to study at the University of Oxford.', 'scholarships@rhodeshouse.ox.ac.uk', 'United Kingdom', true),
  ('cccccccc-cccc-4ccc-cccc-cccccccccccc', 'US-UK Fulbright Commission', 'Government Bilateral Exchange', 'https://fulbright.org.uk', 'Fosters international leadership through merit-based cultural and academic exchange.', 'advising@fulbright.org.uk', 'United States', true),
  ('dddddddd-dddd-4ddd-dddd-dddddddddddd', 'DAAD (German Academic Exchange Service)', 'National Higher Education Agency', 'https://www.daad.de', 'German agency for international academic cooperation and exchange programs.', 'postmaster@daad.de', 'Germany', true),
  ('eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', 'Mastercard Foundation Scholars Program', 'International Development Foundation', 'https://mastercardfdn.org', 'Provides education and leadership opportunities for talented young people.', 'scholars@mastercardfdn.org', 'Canada', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, website = EXCLUDED.website;

-- Seed Admin User
INSERT INTO public.admin_users (id, first_name, last_name, email, role, status, assigned_department)
VALUES
  ('99999999-9999-4999-a999-999999999999', 'Operations', 'Lead', 'admin@scholarpath.org', 'Super Admin', 'Active', 'Governance & Operations')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Seed Scholarships
INSERT INTO public.scholarships (
  id, title, provider_id, provider_name, category, tags, amount, currency,
  funding_type, eligible_countries, education_levels, fields_of_study, minimum_gpa,
  gpa_scale, deadline, status, verification_status, verified_by, verified_at,
  view_count, save_count, required_documents, description, short_description,
  application_instructions, application_url
)
VALUES
  (
    '10000000-0000-4000-a000-000000000001',
    'Gates Cambridge Postgraduate Fellowship',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'Bill & Melinda Gates Foundation',
    'STEM & Tech',
    ARRAY['Cambridge', 'Postgraduate', 'Fully Funded', 'Research', 'STEM'],
    65000, 'GBP', 'Fully funded',
    ARRAY['All'], ARRAY['Postgraduate (Masters)', 'Doctorate (PhD)'],
    ARRAY['Computer Science', 'Biomedical Engineering', 'Data Science', 'Mathematics', 'Physics'],
    3.70, 4.0, NOW() + INTERVAL '60 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    142, 38,
    ARRAY['CV / Resume', 'Official Transcript', 'Recommendation Letter 1', 'Recommendation Letter 2', 'Statement of Purpose / Essay'],
    'Gates Cambridge Scholarships are prestigious, highly competitive full-cost awards for graduate study in any subject available at the University of Cambridge.',
    'Full-cost postgraduate scholarship to study at the University of Cambridge for outstanding applicants from outside the UK.',
    'Apply directly via the University of Cambridge Graduate Application Portal.',
    'https://www.gatescambridge.org/apply/'
  ),
  (
    '10000000-0000-4000-a000-000000000002',
    'Rhodes Global Scholarship at University of Oxford',
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'The Rhodes Trust',
    'Postgraduate & PhD',
    ARRAY['Oxford', 'Leadership', 'Fully Funded', 'International'],
    72000, 'GBP', 'Fully funded',
    ARRAY['All'], ARRAY['Postgraduate (Masters)', 'Doctorate (PhD)'],
    ARRAY['All'],
    3.75, 4.0, NOW() + INTERVAL '45 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    215, 76,
    ARRAY['Official Transcript', 'CV / Resume', 'Statement of Purpose / Essay', 'Recommendation Letter 1', 'Recommendation Letter 2'],
    'The Rhodes Scholarship is the oldest and perhaps most prestigious international scholarship programme in the world.',
    'World-renowned fully funded scholarship supporting graduate study at Oxford University.',
    'Submit formal application via Rhodes Trust constituency portal with personal statement.',
    'https://www.rhodeshouse.ox.ac.uk/scholarships/applications/'
  ),
  (
    '10000000-0000-4000-a000-000000000003',
    'Fulbright Foreign Student Exchange Program',
    'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    'US-UK Fulbright Commission',
    'Undergraduate',
    ARRAY['USA', 'Exchange', 'Tuition', 'Stipend', 'Global'],
    50000, 'USD', 'Fully funded',
    ARRAY['All'], ARRAY['Undergraduate', 'Postgraduate (Masters)'],
    ARRAY['All'],
    3.20, 4.0, NOW() + INTERVAL '30 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    189, 52,
    ARRAY['Official Transcript', 'Standardized Test Score (SAT/GRE/TOEFL)', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    'The Fulbright Foreign Student Program enables graduate students and young professionals from abroad to research and study in the United States.',
    'Prestigious bilateral exchange funding tuition, living stipend, and airfare for studies in the United States.',
    'Apply through the binational Fulbright Commission or US Embassy public affairs section in your home country.',
    'https://foreign.fulbrightonline.org/'
  ),
  (
    '10000000-0000-4000-a000-000000000004',
    'DAAD Helmut Schmidt Master Scholarship in Public Policy',
    'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    'DAAD (German Academic Exchange Service)',
    'Law & Public Policy',
    ARRAY['Germany', 'Public Policy', 'Good Governance', 'Europe'],
    36000, 'EUR', 'Fully funded',
    ARRAY['All'], ARRAY['Postgraduate (Masters)'],
    ARRAY['Law & Public Policy', 'Economics', 'Political Science', 'International Relations'],
    3.00, 4.0, NOW() + INTERVAL '75 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    94, 29,
    ARRAY['CV / Resume', 'Official Transcript', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    'This DAAD program supports future leaders from developing countries who wish to promote democracy and social justice.',
    'Full German scholarship for future leaders pursuing a Masters degree in Public Policy and Good Governance.',
    'Submit application directly to participating German universities during the annual application window.',
    'https://www.daad.de'
  ),
  (
    '10000000-0000-4000-a000-000000000005',
    'Mastercard Foundation STEM Leadership Award',
    'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
    'Mastercard Foundation Scholars Program',
    'STEM & Tech',
    ARRAY['Africa', 'Leadership', 'Undergraduate', 'Tech', 'Full Tuition'],
    45000, 'USD', 'Fully funded',
    ARRAY['All'], ARRAY['Undergraduate', 'Postgraduate (Masters)'],
    ARRAY['Computer Science', 'Software Engineering', 'Information Technology', 'Civil Engineering'],
    3.30, 4.0, NOW() + INTERVAL '20 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    310, 88,
    ARRAY['Official Transcript', 'Financial Need Statement', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    'Comprehensive scholarship covering tuition, accommodation, books, living stipend, and laptop for gifted students.',
    'Full undergraduate & graduate funding covering tuition, living expenses, and tech equipment for promising STEM leaders.',
    'Apply through partner university admissions offices participating in the Scholars Program.',
    'https://mastercardfdn.org'
  ),
  (
    '10000000-0000-4000-a000-000000000006',
    'International Biomedical Research Grant',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'Bill & Melinda Gates Foundation',
    'Health & Medicine',
    ARRAY['Biomedical', 'Medicine', 'Research', 'Healthcare'],
    40000, 'USD', 'Grant',
    ARRAY['All'], ARRAY['Postgraduate (Masters)', 'Doctorate (PhD)', 'Postdoctoral'],
    ARRAY['Medicine', 'Health & Medicine', 'Biochemistry', 'Epidemiology'],
    3.50, 4.0, NOW() + INTERVAL '15 days',
    'verified', 'verified', '99999999-9999-4999-a999-999999999999', NOW(),
    160, 44,
    ARRAY['Official Transcript', 'CV / Resume', 'Portfolio / Project Sample', 'Statement of Purpose / Essay'],
    'Direct grant funding for researchers advancing infectious disease treatment and diagnostic innovation.',
    'Research grant supporting graduate and post-doctoral research projects tackling infectious disease prevention.',
    'Submit research outline and faculty sponsorship letter through the foundation portal.',
    'https://www.gatesfoundation.org'
  )
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, deadline = EXCLUDED.deadline;
