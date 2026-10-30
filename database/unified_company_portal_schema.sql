-- ============================================================================
-- PUVIMA CONSULTANCY — COMPANY MANAGEMENT PORTAL
-- Complete Unified Database Schema, Security Policies & Seed Data
-- ============================================================================
-- Compatible with PostgreSQL 15+ / Supabase
-- Run this in your Supabase Dashboard:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USER ID COUNTERS (For Automatic ADM0001, HR0001, EMP0001, INT0001)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_id_counters (
    role_prefix TEXT PRIMARY KEY CHECK (role_prefix IN ('ADM', 'HR', 'EMP', 'INT')),
    last_value INTEGER NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

INSERT INTO public.user_id_counters (role_prefix, last_value)
VALUES
    ('ADM', 1),
    ('HR', 1),
    ('EMP', 2),
    ('INT', 2)
ON CONFLICT (role_prefix) DO NOTHING;

-- Auto generator function
CREATE OR REPLACE FUNCTION public.generate_user_code(role_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    normalized_role TEXT;
    selected_prefix TEXT;
    next_number INTEGER;
BEGIN
    normalized_role := LOWER(TRIM(role_name));

    selected_prefix := CASE normalized_role
        WHEN 'superadmin' THEN 'ADM'
        WHEN 'admin' THEN 'ADM'
        WHEN 'hr' THEN 'HR'
        WHEN 'employee' THEN 'EMP'
        WHEN 'intern' THEN 'INT'
        ELSE NULL
    END;

    IF selected_prefix IS NULL THEN
        RAISE EXCEPTION 'Invalid role: %', role_name;
    END IF;

    INSERT INTO public.user_id_counters (role_prefix, last_value)
    VALUES (selected_prefix, 0)
    ON CONFLICT (role_prefix) DO NOTHING;

    UPDATE public.user_id_counters
    SET last_value = last_value + 1
    WHERE role_prefix = selected_prefix
    RETURNING last_value INTO next_number;

    RETURN selected_prefix || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- ============================================================================
-- 2. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_code TEXT UNIQUE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (
        role IN ('SuperAdmin', 'Admin', 'HR', 'Employee', 'Intern')
    ),
    department TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_user_code_format
        CHECK (
            user_code IS NULL
            OR user_code ~ '^(ADM|HR|EMP|INT)[0-9]{4,}$'
        )
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON public.profiles(user_code);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Intern-Based', 'Main Project')),
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (
        status IN ('Draft', 'Published', 'In Progress', 'Completed', 'Archived')
    ),
    lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT projects_valid_dates CHECK (
        due_date IS NULL
        OR start_date IS NULL
        OR due_date >= start_date
    )
);

CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON public.projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON public.projects(published_at);

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. PROJECT MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Lead', 'Member')),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT project_members_unique_assignment UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON public.project_members(role);

DROP TRIGGER IF EXISTS project_members_set_updated_at ON public.project_members;
CREATE TRIGGER project_members_set_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. TIMELINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    timeline_type TEXT NOT NULL CHECK (timeline_type IN ('Main', 'Staff')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT timelines_unique_project_type UNIQUE (project_id, timeline_type)
);

CREATE INDEX IF NOT EXISTS idx_timelines_project_id ON public.timelines(project_id);
CREATE INDEX IF NOT EXISTS idx_timelines_timeline_type ON public.timelines(timeline_type);

DROP TRIGGER IF EXISTS timelines_set_updated_at ON public.timelines;
CREATE TRIGGER timelines_set_updated_at
BEFORE UPDATE ON public.timelines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. TIMELINE ENTRIES (Discussions, Milestones, Technical Logs, Replies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.timeline_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.timeline_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    timeline_type TEXT NOT NULL DEFAULT 'Main' CHECK (timeline_type IN ('Main', 'Staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT timeline_entries_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_project_id ON public.timeline_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_timeline_id ON public.timeline_entries(timeline_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_parent_id ON public.timeline_entries(parent_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_user_id ON public.timeline_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_timeline_type ON public.timeline_entries(timeline_type);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_created_at ON public.timeline_entries(created_at DESC);

DROP TRIGGER IF EXISTS timeline_entries_set_updated_at ON public.timeline_entries;
CREATE TRIGGER timeline_entries_set_updated_at
BEFORE UPDATE ON public.timeline_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. ATTACHMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
    entry_id UUID NOT NULL REFERENCES public.timeline_entries(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_type TEXT,
    file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT attachments_file_name_not_empty CHECK (LENGTH(TRIM(file_name)) > 0),
    CONSTRAINT attachments_file_path_not_empty CHECK (LENGTH(TRIM(file_path)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_attachments_project_id ON public.attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_timeline_id ON public.attachments(timeline_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON public.attachments(entry_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments(uploaded_by);

-- ============================================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT notifications_message_not_empty CHECK (LENGTH(TRIM(message)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 10. SECURITY HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        JOIN public.profiles AS p
          ON p.id = pm.user_id
        WHERE pm.project_id = target_project_id
          AND pm.user_id = auth.uid()
          AND p.is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_projects()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.current_user_role() IN ('SuperAdmin', 'Admin', 'HR');
$$;

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles FOR SELECT TO authenticated
USING (
    id = (SELECT auth.uid())
    OR public.current_user_role() IN ('SuperAdmin', 'Admin')
    OR (public.current_user_role() = 'HR' AND is_active = TRUE)
);

DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles FOR UPDATE TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
    OR (
        id = (SELECT auth.uid())
        AND public.is_active_user()
    )
);

-- Projects Policies
DROP POLICY IF EXISTS projects_select_policy ON public.projects;
CREATE POLICY projects_select_policy ON public.projects FOR SELECT TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR status IN ('Published', 'In Progress', 'Completed', 'Archived')
    )
);

DROP POLICY IF EXISTS projects_insert_policy ON public.projects;
CREATE POLICY projects_insert_policy ON public.projects FOR INSERT TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
    AND created_by = auth.uid()
);

DROP POLICY IF EXISTS projects_update_policy ON public.projects;
CREATE POLICY projects_update_policy ON public.projects FOR UPDATE TO authenticated
USING (
    public.is_active_user()
    AND public.can_manage_projects()
);

-- Project Members Policies
DROP POLICY IF EXISTS project_members_select_policy ON public.project_members;
CREATE POLICY project_members_select_policy ON public.project_members FOR SELECT TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR public.is_project_member(project_id)
    )
);

DROP POLICY IF EXISTS project_members_insert_policy ON public.project_members;
CREATE POLICY project_members_insert_policy ON public.project_members FOR INSERT TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
);

DROP POLICY IF EXISTS project_members_delete_policy ON public.project_members;
CREATE POLICY project_members_delete_policy ON public.project_members FOR DELETE TO authenticated
USING (
    public.is_active_user()
    AND public.can_manage_projects()
);

-- Timelines Policies
DROP POLICY IF EXISTS timelines_select_policy ON public.timelines;
CREATE POLICY timelines_select_policy ON public.timelines FOR SELECT TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR (
            timeline_type = 'Main'
            AND public.is_project_member(project_id)
        )
    )
);

-- Timeline Entries Policies
DROP POLICY IF EXISTS timeline_entries_select_policy ON public.timeline_entries;
CREATE POLICY timeline_entries_select_policy ON public.timeline_entries FOR SELECT TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR public.is_project_member(project_id)
    )
);

DROP POLICY IF EXISTS timeline_entries_insert_policy ON public.timeline_entries;
CREATE POLICY timeline_entries_insert_policy ON public.timeline_entries FOR INSERT TO authenticated
WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
    AND (
        (
            timeline_type = 'Main'
            AND (
                public.can_manage_projects()
                OR public.is_project_member(project_id)
            )
        )
        OR (
            timeline_type = 'Staff'
            AND public.can_manage_projects()
        )
    )
);

DROP POLICY IF EXISTS timeline_entries_delete_policy ON public.timeline_entries;
CREATE POLICY timeline_entries_delete_policy ON public.timeline_entries FOR DELETE TO authenticated
USING (
    public.can_manage_projects()
);

-- Notifications Policies
DROP POLICY IF EXISTS notifications_select_policy ON public.notifications;
CREATE POLICY notifications_select_policy ON public.notifications FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    AND public.is_active_user()
);

DROP POLICY IF EXISTS notifications_update_policy ON public.notifications;
CREATE POLICY notifications_update_policy ON public.notifications FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    AND public.is_active_user()
)
WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_user()
);

-- ============================================================================
-- 12. SEED WORKFORCE DEMO PROFILES (WITH AUTH.USERS SYNCHRONIZATION)
-- ============================================================================
-- Creates default auth users if not existing, then inserts matching public profiles
DO $$
DECLARE
    uid_admin UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
    uid_hr    UUID := 'a0000000-0000-0000-0000-000000000002'::UUID;
    uid_emp1  UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
    uid_emp2  UUID := 'a0000000-0000-0000-0000-000000000004'::UUID;
    uid_int1  UUID := 'a0000000-0000-0000-0000-000000000005'::UUID;
    uid_int2  UUID := 'a0000000-0000-0000-0000-000000000006'::UUID;

    proj1_id  UUID := 'b0000000-0000-0000-0000-000000000001'::UUID;
    proj2_id  UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
    time1_id  UUID := 'c0000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- 1. Insert into auth.users (default test password: Password123!)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES
        (uid_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@puvima.com', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Dr. P. Sundaram"}', NOW(), NOW()),
        (uid_hr,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hr@puvima.com',    crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Ananya Sharma"}', NOW(), NOW()),
        (uid_emp1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karthik@puvima.com', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Karthik Raman"}', NOW(), NOW()),
        (uid_emp2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@puvima.com',   crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Priya Narayanan"}', NOW(), NOW()),
        (uid_int1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sneha@puvima.com',   crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Sneha Patel"}', NOW(), NOW()),
        (uid_int2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'arjun@puvima.com',   crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Arjun Verma"}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert into public.profiles
    INSERT INTO public.profiles (id, user_id, user_code, name, email, role, department, is_active)
    VALUES
        (uid_admin, uid_admin, 'ADM0001', 'Dr. P. Sundaram', 'admin@puvima.com', 'SuperAdmin', 'Executive Board', TRUE),
        (uid_hr,    uid_hr,    'HR0001',  'Ananya Sharma',   'hr@puvima.com',    'HR',         'Human Resources', TRUE),
        (uid_emp1,  uid_emp1,  'EMP0001', 'Karthik Raman',   'karthik@puvima.com', 'Employee',  'Robotics & Autonomous Systems', TRUE),
        (uid_emp2,  uid_emp2,  'EMP0002', 'Priya Narayanan', 'priya@puvima.com',   'Employee',  'FinTech & Stock Analytics', TRUE),
        (uid_int1,  uid_int1,  'INT0001', 'Sneha Patel',     'sneha@puvima.com',   'Intern',    'AI/ML & Research Solutions', TRUE),
        (uid_int2,  uid_int2,  'INT0002', 'Arjun Verma',     'arjun@puvima.com',   'Intern',    'Robotics & Autonomous Systems', TRUE)
    ON CONFLICT (id) DO UPDATE SET
        user_code = EXCLUDED.user_code,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        is_active = EXCLUDED.is_active;

    -- 3. Insert Initial Projects
    INSERT INTO public.projects (id, name, category, description, status, lead_id, created_by, published_by, published_at, start_date, due_date)
    VALUES
        (proj1_id, 'Autonomous Marine Waste Collection Robot', 'Main Project', 'Autonomous surface vehicle equipped with computer vision for detecting and collecting plastic debris in coastal waters and harbors.', 'In Progress', uid_emp1, uid_hr, uid_hr, NOW() - INTERVAL '20 days', (CURRENT_DATE - INTERVAL '20 days')::date, (CURRENT_DATE + INTERVAL '60 days')::date),
        (proj2_id, 'Algorithmic Stock Trend Prediction Engine', 'Main Project', 'High-frequency market trend detection model using LSTM networks and historical NSE/BSE tick data.', 'In Progress', uid_emp2, uid_hr, uid_hr, NOW() - INTERVAL '18 days', (CURRENT_DATE - INTERVAL '18 days')::date, (CURRENT_DATE + INTERVAL '45 days')::date)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Insert Project Members
    INSERT INTO public.project_members (project_id, user_id, role, assigned_by)
    VALUES
        (proj1_id, uid_emp1, 'Lead', uid_hr),
        (proj1_id, uid_int2, 'Member', uid_hr),
        (proj2_id, uid_emp2, 'Lead', uid_hr),
        (proj2_id, uid_int1, 'Member', uid_hr)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    -- 5. Insert Timelines
    INSERT INTO public.timelines (id, project_id, timeline_type, title, description, created_by)
    VALUES
        (time1_id, proj1_id, 'Main', 'General Project Timeline', 'Main collaborative progress stream', uid_hr)
    ON CONFLICT (project_id, timeline_type) DO NOTHING;

    -- 6. Insert Timeline Entries
    INSERT INTO public.timeline_entries (project_id, timeline_id, user_id, content, timeline_type)
    VALUES
        (proj1_id, time1_id, uid_emp1, 'Hull hydrodynamic testing and thruster calibration completed in the water tank. Telemetry feed is stable at 24Hz.', 'Main')
    ON CONFLICT DO NOTHING;

END;
$$;

-- Grant permissions to public/authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
