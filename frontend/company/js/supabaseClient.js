/**
 * PUVIMA Consultancy — Supabase Client Initializer & State Provider
 * Connects to Supabase backend or transparently provisions cached data
 */

(function () {
  let client = null;
  const url = (window.CONFIG && window.CONFIG.SUPABASE_URL) || 'https://dcecmefvywxzgqndmcdg.supabase.co';
  const anonKey = (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || 'sb_publishable_wwXhe3J_RJ_tvTbMha71Gg_00NeLor2';

  // Initialize Supabase Client if library is loaded
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    try {
      client = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      console.log('[PUVIMA Portal] Supabase client initialized.');
    } catch (e) {
      console.warn('[PUVIMA Portal] Error creating Supabase client:', e);
    }
  }

  // Initial Demo Seed Data for fallback / instant offline testing
  const initialProfiles = [
    {
      id: 'usr-admin-1',
      user_code: 'ADM0001',
      user_id: 'usr-admin-1',
      name: 'Dr. P. Sundaram',
      email: 'admin@puvima.com',
      role: 'SuperAdmin',
      department: 'Executive Board',
      is_active: true,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: 'usr-hr-1',
      user_code: 'HR0001',
      user_id: 'usr-hr-1',
      name: 'Ananya Sharma',
      email: 'hr@puvima.com',
      role: 'HR',
      department: 'Human Resources',
      is_active: true,
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
    {
      id: 'usr-emp-1',
      user_code: 'EMP0001',
      user_id: 'usr-emp-1',
      name: 'Karthik Raman',
      email: 'karthik@puvima.com',
      role: 'Employee',
      department: 'Robotics & Autonomous Systems',
      is_active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'usr-emp-2',
      user_code: 'EMP0002',
      user_id: 'usr-emp-2',
      name: 'Priya Narayanan',
      email: 'priya@puvima.com',
      role: 'Employee',
      department: 'FinTech & Stock Analytics',
      is_active: true,
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    },
    {
      id: 'usr-int-1',
      user_code: 'INT0001',
      user_id: 'usr-int-1',
      name: 'Sneha Patel',
      email: 'sneha@puvima.com',
      role: 'Intern',
      department: 'AI/ML & Research Solutions',
      is_active: true,
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      id: 'usr-int-2',
      user_code: 'INT0002',
      user_id: 'usr-int-2',
      name: 'Arjun Verma',
      email: 'arjun@puvima.com',
      role: 'Intern',
      department: 'Robotics & Autonomous Systems',
      is_active: true,
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
  ];

  const initialProjects = [
    {
      id: 'proj-001',
      name: 'Autonomous Marine Waste Collection Robot',
      category: 'Main Project',
      description: 'Autonomous surface vehicle equipped with computer vision for detecting and collecting plastic debris in coastal waters and harbors.',
      status: 'In Progress',
      lead_id: 'usr-emp-1',
      created_by: 'usr-hr-1',
      published_by: 'usr-hr-1',
      published_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      start_date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
      due_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
      created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      members: ['usr-emp-1', 'usr-int-2'],
    },
    {
      id: 'proj-002',
      name: 'Algorithmic Stock Trend Prediction Engine',
      category: 'Main Project',
      description: 'High-frequency market trend detection model using LSTM networks and historical NSE/BSE tick data.',
      status: 'In Progress',
      lead_id: 'usr-emp-2',
      created_by: 'usr-hr-1',
      published_by: 'usr-hr-1',
      published_at: new Date(Date.now() - 18 * 86400000).toISOString(),
      start_date: new Date(Date.now() - 18 * 86400000).toISOString().split('T')[0],
      due_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
      created_at: new Date(Date.now() - 19 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      members: ['usr-emp-2', 'usr-int-1'],
    },
    {
      id: 'proj-003',
      name: 'Computer Vision Defect Detection Pipeline',
      category: 'Intern-Based',
      description: 'Edge-AI model evaluating micro-surface defects in precision engineering prototypes using lightweight YOLO architectures.',
      status: 'Draft',
      lead_id: 'usr-emp-1',
      created_by: 'usr-hr-1',
      published_by: null,
      published_at: null,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      members: ['usr-emp-1', 'usr-int-1'],
    },
    {
      id: 'proj-004',
      name: 'Intelligent Autonomous Docking System v1.0',
      category: 'Main Project',
      description: 'LiDAR and ultrasonic sensor fusion for precision automated docking in confined testing enclosures.',
      status: 'Completed',
      lead_id: 'usr-emp-1',
      created_by: 'usr-hr-1',
      published_by: 'usr-hr-1',
      published_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      start_date: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      due_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      completed_at: new Date(Date.now() - 8 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 95 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 8 * 86400000).toISOString(),
      members: ['usr-emp-1', 'usr-emp-2'],
    },
  ];

  const initialTimelines = [
    {
      id: 'entry-001',
      project_id: 'proj-001',
      timeline_type: 'Main',
      user_id: 'usr-emp-1',
      content: 'Hull hydrodynamic testing and thruster calibration completed in the water tank. Telemetry feed is stable at 24Hz.',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      attachments: [
        {
          id: 'att-1',
          file_name: 'thruster_calibration_report.pdf',
          file_size: 1420500,
          file_type: 'application/pdf',
        },
      ],
      replies: [
        {
          id: 'rep-1',
          user_id: 'usr-hr-1',
          content: 'Excellent progress Karthik. Please ensure safety checklists are attached for the upcoming harbor trial.',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ],
    },
    {
      id: 'entry-002',
      project_id: 'proj-001',
      timeline_type: 'Staff',
      user_id: 'usr-hr-1',
      content: 'Internal Staff Note: Harbor testing permit has been granted by port authority. Budget approval for maritime test session is confirmed.',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      attachments: [],
      replies: [],
    },
  ];

  const initialNotifications = [
    {
      id: 'notif-1',
      user_id: 'usr-emp-1',
      project_id: 'proj-001',
      title: 'Project Update Added',
      message: 'Ananya Sharma commented on your marine robot timeline update.',
      type: 'info',
      is_read: false,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'notif-2',
      user_id: 'usr-int-1',
      project_id: 'proj-002',
      title: 'Assigned to Project',
      message: 'You have been assigned to Algorithmic Stock Trend Prediction Engine.',
      type: 'success',
      is_read: false,
      created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    },
  ];

  // Initialize Local Storage stores if not already existing
  function initStore(key, initialData) {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(initialData));
    }
  }

  initStore('puvima_portal_profiles', initialProfiles);
  initStore('puvima_portal_projects', initialProjects);
  initStore('puvima_portal_timelines', initialTimelines);
  initStore('puvima_portal_notifications', initialNotifications);

  window.portalClient = {
    supabase: client,
    hasSupabase: !!client,
  };
})();
