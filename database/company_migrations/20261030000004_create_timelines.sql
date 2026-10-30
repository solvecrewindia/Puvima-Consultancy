-- supabase/migrations/004_create_timelines.sql

CREATE TABLE IF NOT EXISTS public.timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,

    timeline_type TEXT NOT NULL
        CHECK (timeline_type IN ('Main', 'Staff')),

    title TEXT NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    created_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT timelines_unique_project_type
        UNIQUE (project_id, timeline_type)
);

ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_timelines_project_id
    ON public.timelines(project_id);

CREATE INDEX IF NOT EXISTS idx_timelines_timeline_type
    ON public.timelines(timeline_type);

DROP TRIGGER IF EXISTS timelines_set_updated_at
    ON public.timelines;

CREATE TRIGGER timelines_set_updated_at
BEFORE UPDATE ON public.timelines
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------
-- Timeline Entries (Messages, Updates, Technical Logs, Replies)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timeline_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,

    timeline_id UUID NOT NULL
        REFERENCES public.timelines(id) ON DELETE CASCADE,

    parent_id UUID
        REFERENCES public.timeline_entries(id) ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    content TEXT NOT NULL,

    timeline_type TEXT NOT NULL DEFAULT 'Main'
        CHECK (timeline_type IN ('Main', 'Staff')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT timeline_entries_content_not_empty
        CHECK (LENGTH(TRIM(content)) > 0)
);

ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_timeline_entries_project_id
    ON public.timeline_entries(project_id);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_timeline_id
    ON public.timeline_entries(timeline_id);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_parent_id
    ON public.timeline_entries(parent_id);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_user_id
    ON public.timeline_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_timeline_type
    ON public.timeline_entries(timeline_type);

CREATE INDEX IF NOT EXISTS idx_timeline_entries_created_at
    ON public.timeline_entries(created_at DESC);

DROP TRIGGER IF EXISTS timeline_entries_set_updated_at
    ON public.timeline_entries;

CREATE TRIGGER timeline_entries_set_updated_at
BEFORE UPDATE ON public.timeline_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
