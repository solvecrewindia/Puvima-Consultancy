-- supabase/migrations/007_create_user_id_generation.sql

CREATE TABLE IF NOT EXISTS public.user_id_counters (
    role_prefix TEXT PRIMARY KEY
        CHECK (role_prefix IN ('ADM', 'HR', 'EMP', 'INT')),

    last_value INTEGER NOT NULL DEFAULT 0
        CHECK (last_value >= 0)
);

INSERT INTO public.user_id_counters (role_prefix, last_value)
VALUES
    ('ADM', 1),
    ('HR', 1),
    ('EMP', 2),
    ('INT', 2)
ON CONFLICT (role_prefix) DO NOTHING;


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


REVOKE ALL ON FUNCTION public.generate_user_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_user_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_user_code(TEXT) TO authenticated;
