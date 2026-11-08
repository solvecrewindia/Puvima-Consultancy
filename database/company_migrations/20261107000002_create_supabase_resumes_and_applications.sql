-- ============================================================================
-- PUVIMA Consultancy — Supabase Resume Storage & Candidate Applications Schema
-- Migration: 20261107000002_create_supabase_resumes_and_applications.sql
-- Database: Supabase PostgreSQL & Storage
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Supabase Storage Bucket for Resumes
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resumes',
    'resumes',
    true,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies for 'resumes' bucket
DROP POLICY IF EXISTS "Allow public resume upload" ON storage.objects;
CREATE POLICY "Allow public resume upload" ON storage.objects
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (bucket_id = 'resumes');

DROP POLICY IF EXISTS "Allow public resume read" ON storage.objects;
CREATE POLICY "Allow public resume read" ON storage.objects
    FOR SELECT TO anon, authenticated, service_role
    USING (bucket_id = 'resumes');

-- ----------------------------------------------------------------------------
-- 2. Resume Documents Binary Storage Table (Zero-Loss Supabase DB Fallback)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resume_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_data_base64 TEXT NOT NULL,
    storage_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_docs_ref ON public.resume_documents(reference_id);

ALTER TABLE public.resume_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert resume_documents" ON public.resume_documents;
CREATE POLICY "Allow insert resume_documents" ON public.resume_documents
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select resume_documents" ON public.resume_documents;
CREATE POLICY "Allow select resume_documents" ON public.resume_documents
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

-- ----------------------------------------------------------------------------
-- 3. Candidate Internship & Careers Applications Table in Supabase
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internship_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    city_state VARCHAR(128) NOT NULL,
    linkedin_url VARCHAR(255),
    college VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    study_year VARCHAR(64) NOT NULL,
    graduation_year VARCHAR(16) NOT NULL,
    cgpa_range VARCHAR(64) NOT NULL,
    internship_role VARCHAR(128) NOT NULL,
    skills JSONB,
    strongest_skills TEXT,
    projects_experience TEXT,
    github_portfolio_url VARCHAR(255),
    
    -- Resume Storage in Supabase
    resume_filename VARCHAR(255) NOT NULL,
    resume_mime_type VARCHAR(128) NOT NULL,
    resume_size_bytes BIGINT NOT NULL,
    resume_storage_key VARCHAR(255),
    resume_supabase_url TEXT,
    resume_supabase_path VARCHAR(512),
    
    motivation TEXT,
    expected_contribution TEXT,
    internship_mode VARCHAR(64),
    duration VARCHAR(64),
    joining_availability VARCHAR(64),
    specific_joining_date DATE,
    weekly_hours VARCHAR(64),
    referral_source VARCHAR(128),
    other_referral_details VARCHAR(255),
    additional_information TEXT,
    
    recruitment_status VARCHAR(64) NOT NULL DEFAULT 'New',
    admin_notes TEXT DEFAULT '',
    is_reviewed_by_hr SMALLINT DEFAULT 0,
    hr_reviewed_at TIMESTAMPTZ,
    hr_reviewed_by VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_ref_id ON public.internship_applications(reference_id);
CREATE INDEX IF NOT EXISTS idx_ia_email ON public.internship_applications(email);
CREATE INDEX IF NOT EXISTS idx_ia_role ON public.internship_applications(internship_role);
CREATE INDEX IF NOT EXISTS idx_ia_status ON public.internship_applications(recruitment_status);
CREATE INDEX IF NOT EXISTS idx_ia_created_at ON public.internship_applications(created_at DESC);

ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon submit internship application" ON public.internship_applications;
CREATE POLICY "Allow anon submit internship application" ON public.internship_applications
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read internship applications" ON public.internship_applications;
CREATE POLICY "Allow read internship applications" ON public.internship_applications
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow update internship applications" ON public.internship_applications;
CREATE POLICY "Allow update internship applications" ON public.internship_applications
    FOR UPDATE TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

