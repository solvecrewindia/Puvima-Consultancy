-- ============================================================================
-- PUVIMA CONSULTANCY — SEED DATA
-- Seeds initial counters, demo accounts, projects & timeline entries
-- ============================================================================

INSERT INTO public.user_id_counters (role_prefix, last_value)
VALUES
    ('ADM', 1),
    ('HR', 1),
    ('EMP', 2),
    ('INT', 2)
ON CONFLICT (role_prefix) DO NOTHING;

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
    -- 1. Insert Auth Users (Password: Password123!)
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

    -- 2. Insert Profiles
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
