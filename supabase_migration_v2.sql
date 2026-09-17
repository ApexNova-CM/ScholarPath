-- ==============================================================================
-- SCHOLAR PATH — Migration V2: Document Vault + Required Documents + Snapshots
-- ==============================================================================
-- Run this AFTER the original supabase_schema_and_policies.sql
-- Safe to run multiple times (uses IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ==============================================================================

-- ─── 1. DOCUMENT TYPES TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard document types
INSERT INTO public.document_types (name, slug, description, sort_order) VALUES
  ('Academic Transcript',    'academic-transcript',    'Official academic transcript from your institution',       1),
  ('Statement of Result',    'statement-of-result',    'Official statement of results or results slip',            2),
  ('Admission Letter',       'admission-letter',       'Letter of admission from your institution',                3),
  ('Student ID',             'student-id',             'Valid student identification card',                        4),
  ('National ID',            'national-id',            'Government-issued national identity document',             5),
  ('Passport Photograph',    'passport-photograph',    'Recent passport-sized photograph',                         6),
  ('CV / Resume',            'cv-resume',              'Curriculum vitae or resume',                               7),
  ('Recommendation Letter',  'recommendation-letter',  'Letter of recommendation from a referee',                  8),
  ('Certificate',            'certificate',            'Academic or professional certificate',                     9),
  ('Personal Statement',     'personal-statement',     'Written personal statement or statement of purpose',      10),
  ('Motivation Letter',      'motivation-letter',      'Letter of motivation for the scholarship',                11),
  ('Proof of Enrollment',    'proof-of-enrollment',    'Document confirming current enrollment',                  12),
  ('Proof of Residence',     'proof-of-residence',     'Document confirming your place of residence',             13),
  ('Other',                  'other',                  'Any other supporting document',                           14)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ─── 2. EXPAND DOCUMENTS TABLE ───────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'pending_verification', 'verified', 'expired')),
  ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES public.document_types(id) ON DELETE SET NULL;

-- ─── 3. SCHOLARSHIP REQUIRED DOCUMENTS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scholarship_required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scholarship_id, document_type_id)
);

CREATE INDEX IF NOT EXISTS idx_scholarship_req_docs_scholarship
  ON public.scholarship_required_documents(scholarship_id);

-- ─── 4. APPLICATION DOCUMENTS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  document_type_name TEXT NOT NULL,
  storage_path_snapshot TEXT,
  original_file_name TEXT,
  file_format TEXT,
  file_size INTEGER,
  status_at_submission TEXT,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_docs_application
  ON public.application_documents(application_id);

-- ─── 5. EXPAND APPLICATIONS TABLE ────────────────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS submitted_profile_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS submitted_documents JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_answers JSONB DEFAULT '{}'::jsonb;

-- ─── 6. EXPAND USERS TABLE ───────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS career_goals TEXT,
  ADD COLUMN IF NOT EXISTS personal_statement TEXT,
  ADD COLUMN IF NOT EXISTS previous_institution TEXT,
  ADD COLUMN IF NOT EXISTS expected_graduation_date TIMESTAMPTZ;

-- ─── 7. ROW LEVEL SECURITY ───────────────────────────────────────────────────

-- document_types (public read, admin write)
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public document types read" ON public.document_types;
CREATE POLICY "Public document types read" ON public.document_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin document types all" ON public.document_types;
CREATE POLICY "Admin document types all" ON public.document_types
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
  );

-- scholarship_required_documents (public read for verified scholarships, admin write)
ALTER TABLE public.scholarship_required_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public scholarship req docs read" ON public.scholarship_required_documents;
CREATE POLICY "Public scholarship req docs read" ON public.scholarship_required_documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin scholarship req docs all" ON public.scholarship_required_documents;
CREATE POLICY "Admin scholarship req docs all" ON public.scholarship_required_documents
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR public.is_admin()
  );

-- application_documents (student owns via application_id, admin read)
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student app docs select" ON public.application_documents;
CREATE POLICY "Student app docs select" ON public.application_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Student app docs insert" ON public.application_documents;
CREATE POLICY "Student app docs insert" ON public.application_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Student app docs delete" ON public.application_documents;
CREATE POLICY "Student app docs delete" ON public.application_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- ─── 8. SUPABASE STORAGE BUCKET (run in Supabase dashboard or via API) ───────
-- NOTE: Run these in the Supabase SQL Editor. The bucket must be created via
-- the Dashboard (Storage → New Bucket → "student-documents", Private) OR
-- via the Management API. The RLS policies below assume the bucket exists.

-- Storage RLS: Student can only access their own folder (user_id prefix)
-- These policies are set on the storage.objects table

DO $$
BEGIN
  -- Create bucket if it doesn't exist (using insert into storage.buckets)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'student-documents',
    'student-documents',
    FALSE,
    10485760,  -- 10 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bucket may already exist or storage extension not available: %', SQLERRM;
END $$;

-- Storage policies (safe drop + create)
DROP POLICY IF EXISTS "Students upload own documents" ON storage.objects;
CREATE POLICY "Students upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'student-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students read own documents" ON storage.objects;
CREATE POLICY "Students read own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'student-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students update own documents" ON storage.objects;
CREATE POLICY "Students update own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'student-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students delete own documents" ON storage.objects;
CREATE POLICY "Students delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'student-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
