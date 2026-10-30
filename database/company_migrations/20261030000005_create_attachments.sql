-- supabase/migrations/005_create_attachments.sql

CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,

    timeline_id UUID NOT NULL
        REFERENCES public.timelines(id) ON DELETE CASCADE,

    entry_id UUID NOT NULL
        REFERENCES public.timeline_entries(id) ON DELETE CASCADE,

    uploaded_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_type TEXT,
    file_size BIGINT NOT NULL DEFAULT 0
        CHECK (file_size >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT attachments_file_name_not_empty
        CHECK (LENGTH(TRIM(file_name)) > 0),

    CONSTRAINT attachments_file_path_not_empty
        CHECK (LENGTH(TRIM(file_path)) > 0)
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachments_project_id
    ON public.attachments(project_id);

CREATE INDEX IF NOT EXISTS idx_attachments_timeline_id
    ON public.attachments(timeline_id);

CREATE INDEX IF NOT EXISTS idx_attachments_entry_id
    ON public.attachments(entry_id);

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by
    ON public.attachments(uploaded_by);