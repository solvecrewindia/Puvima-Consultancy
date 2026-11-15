/**
 * Puvima IT Service and Research Consultancy — Company Management Portal Configuration
 */

const CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: 'https://jarrtmqdhfcijarbuntl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_RXvkWbFuePqt-QdXDt1jzA_sxiJo4ZR',

  // Valid Role Types
  ROLES: {
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Admin',
    HR: 'HR',
    EMPLOYEE: 'Employee',
    INTERN: 'Intern',
  },

  // Project Categories
  PROJECT_CATEGORIES: [
    'Main Project',
    'Intern-Based',
  ],

  // Project Statuses
  PROJECT_STATUSES: {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
  },

  // Company ID prefixes
  USER_CODE_PREFIXES: {
    Admin: 'ADM',
    SuperAdmin: 'ADM',
    HR: 'HR',
    Employee: 'EMP',
    Intern: 'INT',
  },

  // Demo Credentials for Instant Test Sign-In
  DEMO_ACCOUNTS: [
    {
      role: 'Admin',
      roleLabel: 'Website Administrator',
      code: 'admin',
      email: 'admin@puvima.com',
      password: 'admin123',
      name: 'admin',
      department: 'Executive Administration',
    },
    {
      role: 'SuperAdmin',
      roleLabel: 'Super Administrator',
      code: 'admin0001',
      email: 'admin@puvima.com',
      password: 'Puvima@1818',
      name: 'admin0001',
      department: 'Executive Board',
    },
    {
      role: 'HR',
      roleLabel: 'Human Resources Lead',
      code: 'HR0001',
      email: 'hr@puvima.com',
      password: 'hr123',
      name: 'puvima hr',
      department: 'Human Resources',
    },
  ],
};

// Freeze configuration to prevent tampering
if (typeof Object.freeze === 'function') {
  Object.freeze(CONFIG.ROLES);
  Object.freeze(CONFIG.PROJECT_STATUSES);
}

// Export for ES modules and standard browsers
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
