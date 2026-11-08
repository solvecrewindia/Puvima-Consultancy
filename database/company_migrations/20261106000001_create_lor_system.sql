-- ============================================================================
-- PUVIMA CONSULTANCY & RESEARCH — LETTER OF RECOMMENDATION (LOR) SYSTEM
-- Migration: 20261106000001_create_lor_system.sql
-- Database: Supabase PostgreSQL
-- ============================================================================

-- Ensure required cryptographic and UUID extensions are active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Main LOR Requests Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_lor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lor_request_id VARCHAR(64) UNIQUE NOT NULL,
    intern_id UUID,
    intern_email VARCHAR(255) NOT NULL,
    intern_name VARCHAR(255) NOT NULL,
    intern_phone VARCHAR(50),
    domain_specialization VARCHAR(255) NOT NULL,
    college_university VARCHAR(255) NOT NULL,
    department_branch VARCHAR(255),
    internship_start_date VARCHAR(100),
    internship_end_date VARCHAR(100),
    project_title VARCHAR(255),
    project_deliverables TEXT,
    purpose_of_lor TEXT NOT NULL,
    
    -- Professor / Mentor Details
    professor_name VARCHAR(255) NOT NULL,
    professor_designation VARCHAR(255) NOT NULL,
    professor_department VARCHAR(255),
    professor_institution VARCHAR(255) NOT NULL,
    professor_phone VARCHAR(50) NOT NULL,
    professor_email VARCHAR(255) NOT NULL,
    academic_relationship VARCHAR(100) NOT NULL,
    
    -- Cryptographic Verification Token
    verification_token VARCHAR(128) UNIQUE NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status Lifecycle:
    -- 'Draft', 'Email Sent to Professor', 'Confirmed by Professor', 
    -- 'Declined by Professor', 'HR Approved', 'LOR Issued', 'Rejected'
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    
    -- Automated Email & Verification Tracking
    email_sent_at TIMESTAMPTZ,
    email_delivery_status VARCHAR(100),
    professor_confirmed_at TIMESTAMPTZ,
    professor_endorsement_remarks TEXT,
    professor_rating VARCHAR(100),
    professor_ip_address VARCHAR(100),
    
    -- HR Review & Sign-off Actions
    hr_verified_by VARCHAR(255),
    hr_verified_at TIMESTAMPTZ,
    hr_remarks TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Audit Trail for LOR State Transitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_lor_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lor_id UUID REFERENCES public.company_lor_requests(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lor_requests_intern_email 
    ON public.company_lor_requests(intern_email);

CREATE INDEX IF NOT EXISTS idx_lor_requests_verification_token 
    ON public.company_lor_requests(verification_token);

CREATE INDEX IF NOT EXISTS idx_lor_requests_status 
    ON public.company_lor_requests(status);

CREATE INDEX IF NOT EXISTS idx_lor_requests_created_at 
    ON public.company_lor_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lor_audit_lor_id 
    ON public.company_lor_audit(lor_id);

-- ----------------------------------------------------------------------------
-- 4. Automatic Timestamp Update Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_lor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lor_requests_updated_at ON public.company_lor_requests;

CREATE TRIGGER trigger_lor_requests_updated_at
    BEFORE UPDATE ON public.company_lor_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_lor_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Configuration
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_lor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_lor_audit ENABLE ROW LEVEL SECURITY;

-- Allow Backend Server Role Full Access
DROP POLICY IF EXISTS "Allow service role full access on company_lor_requests" ON public.company_lor_requests;
CREATE POLICY "Allow service role full access on company_lor_requests"
    ON public.company_lor_requests FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on company_lor_audit" ON public.company_lor_audit;
CREATE POLICY "Allow service role full access on company_lor_audit"
    ON public.company_lor_audit FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Allow Mentors/Professors with valid token to view and confirm endorsement (Anon/Public)
DROP POLICY IF EXISTS "Allow token holders to view LOR verification" ON public.company_lor_requests;
CREATE POLICY "Allow token holders to view LOR verification"
    ON public.company_lor_requests FOR SELECT TO anon, authenticated
    USING (verification_token IS NOT NULL);

DROP POLICY IF EXISTS "Allow token holders to submit mentor endorsement" ON public.company_lor_requests;
CREATE POLICY "Allow token holders to submit mentor endorsement"
    ON public.company_lor_requests FOR UPDATE TO anon, authenticated
    USING (verification_token IS NOT NULL)
    WITH CHECK (verification_token IS NOT NULL);

-- Allow Authenticated Users (Interns, Employees, HR) to read their records
DROP POLICY IF EXISTS "Allow authenticated read company_lor_requests" ON public.company_lor_requests;
CREATE POLICY "Allow authenticated read company_lor_requests"
    ON public.company_lor_requests FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert company_lor_requests" ON public.company_lor_requests;
CREATE POLICY "Allow authenticated insert company_lor_requests"
    ON public.company_lor_requests FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update company_lor_requests" ON public.company_lor_requests;
CREATE POLICY "Allow authenticated update company_lor_requests"
    ON public.company_lor_requests FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read company_lor_audit" ON public.company_lor_audit;
CREATE POLICY "Allow authenticated read company_lor_audit"
    ON public.company_lor_audit FOR SELECT TO authenticated
    USING (true);
