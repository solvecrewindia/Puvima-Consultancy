-- supabase/migrations/006_create_notifications.sql

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    project_id UUID
        REFERENCES public.projects(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    message TEXT NOT NULL,

    type TEXT NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'success', 'warning', 'error')),

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_title_not_empty
        CHECK (LENGTH(TRIM(title)) > 0),

    CONSTRAINT notifications_message_not_empty
        CHECK (LENGTH(TRIM(message)) > 0)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_project_id
    ON public.notifications(project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON public.notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON public.notifications(created_at DESC);