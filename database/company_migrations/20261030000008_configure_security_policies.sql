-- supabase/migrations/008_configure_security_policies.sql

-- =========================================================
-- SECURITY HELPER FUNCTIONS
-- =========================================================

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


-- =========================================================
-- PROFILES
-- Users can read their own profile.
-- Admins can read all profiles.
-- HR can read active profiles.
-- Users cannot grant themselves roles or reactivate accounts
-- through client-side profile updates.
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy
    ON public.profiles;

CREATE POLICY profiles_select_policy
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = (SELECT auth.uid())
    OR public.current_user_role() IN ('SuperAdmin', 'Admin')
    OR (
        public.current_user_role() = 'HR'
        AND is_active = TRUE
    )
);


DROP POLICY IF EXISTS profiles_update_policy
    ON public.profiles;

CREATE POLICY profiles_update_policy
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
)
WITH CHECK (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
);


-- =========================================================
-- PROJECTS
-- Admin and HR manage projects.
-- Active users can view published projects they belong to.
-- =========================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_policy
    ON public.projects;

CREATE POLICY projects_select_policy
ON public.projects
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR (
            status <> 'Draft'
            AND (
                lead_id = auth.uid()
                OR public.is_project_member(id)
            )
        )
    )
);


DROP POLICY IF EXISTS projects_insert_policy
    ON public.projects;

CREATE POLICY projects_insert_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
    AND created_by = auth.uid()
);


DROP POLICY IF EXISTS projects_update_policy
    ON public.projects;

CREATE POLICY projects_update_policy
ON public.projects
FOR UPDATE
TO authenticated
USING (
    public.is_active_user()
    AND public.can_manage_projects()
)
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
);


DROP POLICY IF EXISTS projects_delete_policy
    ON public.projects;

CREATE POLICY projects_delete_policy
ON public.projects
FOR DELETE
TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
);


-- =========================================================
-- PROJECT MEMBERS
-- Admin and HR manage assignments.
-- Project members can view assignments for projects they belong to.
-- =========================================================

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_members_select_policy
    ON public.project_members;

CREATE POLICY project_members_select_policy
ON public.project_members
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR user_id = auth.uid()
        OR public.is_project_member(project_id)
    )
);


DROP POLICY IF EXISTS project_members_insert_policy
    ON public.project_members;

CREATE POLICY project_members_insert_policy
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
);


DROP POLICY IF EXISTS project_members_update_policy
    ON public.project_members;

CREATE POLICY project_members_update_policy
ON public.project_members
FOR UPDATE
TO authenticated
USING (
    public.can_manage_projects()
)
WITH CHECK (
    public.can_manage_projects()
);


DROP POLICY IF EXISTS project_members_delete_policy
    ON public.project_members;

CREATE POLICY project_members_delete_policy
ON public.project_members
FOR DELETE
TO authenticated
USING (
    public.can_manage_projects()
);


-- =========================================================
-- TIMELINES
-- Project members can view timelines.
-- Admin and HR can manage timelines.
-- =========================================================

ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timelines_select_policy
    ON public.timelines;

CREATE POLICY timelines_select_policy
ON public.timelines
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR public.is_project_member(project_id)
    )
);


DROP POLICY IF EXISTS timelines_insert_policy
    ON public.timelines;

CREATE POLICY timelines_insert_policy
ON public.timelines
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
);


DROP POLICY IF EXISTS timelines_update_policy
    ON public.timelines;

CREATE POLICY timelines_update_policy
ON public.timelines
FOR UPDATE
TO authenticated
USING (
    public.can_manage_projects()
)
WITH CHECK (
    public.can_manage_projects()
);


DROP POLICY IF EXISTS timelines_delete_policy
    ON public.timelines;

CREATE POLICY timelines_delete_policy
ON public.timelines
FOR DELETE
TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
);


-- =========================================================
-- TIMELINE ENTRIES
-- Main timeline: assigned project members can post and reply.
-- Staff timeline: only Admin and HR can post and reply.
-- Entries are retained; deletion is restricted to Admin and HR.
-- =========================================================

ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS timeline_entries_select_policy
    ON public.timeline_entries;

CREATE POLICY timeline_entries_select_policy
ON public.timeline_entries
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR public.is_project_member(project_id)
    )
);


DROP POLICY IF EXISTS timeline_entries_insert_policy
    ON public.timeline_entries;

CREATE POLICY timeline_entries_insert_policy
ON public.timeline_entries
FOR INSERT
TO authenticated
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


DROP POLICY IF EXISTS timeline_entries_update_policy
    ON public.timeline_entries;

CREATE POLICY timeline_entries_update_policy
ON public.timeline_entries
FOR UPDATE
TO authenticated
USING (
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
)
WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
);


DROP POLICY IF EXISTS timeline_entries_delete_policy
    ON public.timeline_entries;

CREATE POLICY timeline_entries_delete_policy
ON public.timeline_entries
FOR DELETE
TO authenticated
USING (
    public.can_manage_projects()
);


-- =========================================================
-- ATTACHMENTS
-- Access follows project access and timeline permissions.
-- =========================================================

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS attachments_select_policy
    ON public.attachments;

CREATE POLICY attachments_select_policy
ON public.attachments
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND (
        public.can_manage_projects()
        OR public.is_project_member(project_id)
    )
);


DROP POLICY IF EXISTS attachments_insert_policy
    ON public.attachments;

CREATE POLICY attachments_insert_policy
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user()
    AND uploaded_by = auth.uid()
    AND (
        public.can_manage_projects()
        OR (
            public.is_project_member(project_id)
            AND EXISTS (
                SELECT 1
                FROM public.timeline_entries AS te
                WHERE te.id = entry_id
                  AND te.project_id = attachments.project_id
                  AND te.timeline_id = attachments.timeline_id
                  AND te.timeline_type = 'Main'
            )
        )
    )
);


DROP POLICY IF EXISTS attachments_delete_policy
    ON public.attachments;

CREATE POLICY attachments_delete_policy
ON public.attachments
FOR DELETE
TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
);


-- =========================================================
-- NOTIFICATIONS
-- Users can view and update their own notifications.
-- Admin and HR can create notifications.
-- =========================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS notifications_select_policy
    ON public.notifications;

CREATE POLICY notifications_select_policy
ON public.notifications
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
    AND user_id = auth.uid()
);


DROP POLICY IF EXISTS notifications_update_policy
    ON public.notifications;

CREATE POLICY notifications_update_policy
ON public.notifications
FOR UPDATE
TO authenticated
USING (
    public.is_active_user()
    AND user_id = auth.uid()
)
WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
);


DROP POLICY IF EXISTS notifications_insert_policy
    ON public.notifications;

CREATE POLICY notifications_insert_policy
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user()
    AND public.can_manage_projects()
);


DROP POLICY IF EXISTS notifications_delete_policy
    ON public.notifications;

CREATE POLICY notifications_delete_policy
ON public.notifications
FOR DELETE
TO authenticated
USING (
    public.current_user_role() IN ('SuperAdmin', 'Admin')
);


-- =========================================================
-- COUNTERS
-- The client must not read or modify the counter table directly.
-- The SECURITY DEFINER function handles ID generation.
-- =========================================================

ALTER TABLE public.user_id_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_id_counters FROM anon;
REVOKE ALL ON TABLE public.user_id_counters FROM authenticated;


-- =========================================================
-- HELPER FUNCTION PERMISSIONS
-- =========================================================

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_project_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_projects() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_projects() TO authenticated;