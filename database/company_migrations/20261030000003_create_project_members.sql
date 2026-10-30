-- supabase/migrations/003_create_project_members.sql

CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    role TEXT NOT NULL DEFAULT 'Member'
        CHECK (role IN ('Lead', 'Member')),

    assigned_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT project_members_unique_assignment
        UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_members_project_id
    ON public.project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
    ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_role
    ON public.project_members(role);

DROP TRIGGER IF EXISTS project_members_set_updated_at
    ON public.project_members;

CREATE TRIGGER project_members_set_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();