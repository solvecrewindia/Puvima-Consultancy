-- ============================================================================
-- PUVIMA CONSULTANCY — COMPLETE ONBOARDING & HR VERIFICATION SYSTEM
-- Database Migration Script for Supabase PostgreSQL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Main Onboarding Applications Table
CREATE TABLE IF NOT EXISTS public.onboarding_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id TEXT UNIQUE NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    position_applied TEXT NOT NULL CHECK (position_applied IN ('Intern', 'Project Trainee', 'Research Associate', 'Other')),
    position_other TEXT,
    domain_interest TEXT NOT NULL,
    preferred_joining_date DATE NOT NULL,
    duration TEXT NOT NULL CHECK (duration IN ('3 Months', '6 Months', 'Other')),
    duration_other TEXT,
    dob DATE NOT NULL,
    gender TEXT NOT NULL,
    nationality TEXT NOT NULL DEFAULT 'Indian',
    id_type TEXT CHECK (id_type IN ('Aadhaar', 'PAN', 'Voter ID', 'Passport')),
    id_number_masked TEXT,
    id_number_encrypted TEXT,
    blood_group TEXT,
    permanent_address TEXT NOT NULL,
    current_address TEXT NOT NULL,
    skills TEXT,
    tools_platforms TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (
        status IN (
            'Draft',
            'Submitted',
            'Under HR Review',
            'Documents Under Verification',
            'Correction Required',
            'Resubmitted',
            'Approved',
            'Rejected'
        )
    ),
    submission_date TIMESTAMPTZ,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    pdf_storage_path TEXT,
    access_token TEXT UNIQUE NOT NULL,
    declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    declaration_timestamp TIMESTAMPTZ,
    applicant_signature_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Academic Information
CREATE TABLE IF NOT EXISTS public.onboarding_academic_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    qualification_type TEXT NOT NULL CHECK (qualification_type IN ('UG', 'PG', 'Others')),
    degree_name TEXT NOT NULL,
    institution TEXT NOT NULL,
    year_of_passing INTEGER NOT NULL,
    score_cgpa TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Projects and Experiences
CREATE TABLE IF NOT EXISTS public.onboarding_projects_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('project', 'experience')),
    title TEXT NOT NULL,
    role_technologies TEXT,
    duration TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Emergency Contacts
CREATE TABLE IF NOT EXISTS public.onboarding_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    contact_person TEXT NOT NULL,
    relationship TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    alternate_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bank Details (Restricted Access)
CREATE TABLE IF NOT EXISTS public.onboarding_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    account_holder_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number_masked TEXT NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Uploaded Documents
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (
        category IN (
            'resume',
            'govt_id',
            'academic_marksheets',
            'passport_photo',
            'bank_proof',
            'offer_letter',
            'other_docs'
        )
    ),
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
        verification_status IN (
            'Pending',
            'Verified',
            'Invalid',
            'Missing',
            'Correction Required'
        )
    ),
    hr_remarks TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Correction Requests
CREATE TABLE IF NOT EXISTS public.onboarding_correction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    affected_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    remarks TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

-- 8. Verification Audit History
CREATE TABLE IF NOT EXISTS public.onboarding_verification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    user_id TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Onboarding Notifications
CREATE TABLE IF NOT EXISTS public.onboarding_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('applicant', 'hr')),
    recipient_email TEXT,
    application_id UUID REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Indexes for fast querying & lookup
CREATE INDEX IF NOT EXISTS idx_onb_app_id ON public.onboarding_applications(application_id);
CREATE INDEX IF NOT EXISTS idx_onb_email ON public.onboarding_applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_onb_status ON public.onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_onb_token ON public.onboarding_applications(access_token);
CREATE INDEX IF NOT EXISTS idx_onb_docs_app ON public.onboarding_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_onb_history_app ON public.onboarding_verification_history(application_id);

-- Enable RLS
ALTER TABLE public.onboarding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_academic_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_projects_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_verification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_notifications ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon access for applicants with valid session/application ID via backend API
CREATE POLICY "Allow service role full access on onboarding_applications"
ON public.onboarding_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_academic_details"
ON public.onboarding_academic_details FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_projects_experiences"
ON public.onboarding_projects_experiences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_emergency_contacts"
ON public.onboarding_emergency_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_bank_details"
ON public.onboarding_bank_details FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_documents"
ON public.onboarding_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_correction_requests"
ON public.onboarding_correction_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_verification_history"
ON public.onboarding_verification_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on onboarding_notifications"
ON public.onboarding_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

