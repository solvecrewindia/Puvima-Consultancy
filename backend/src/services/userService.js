/**
 * Puvima IT Service and Research Consultancy — Company User Profiles Backend Service
 * Server-backed profile management synchronized across all environments.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND_PROFILES_PATH = path.resolve(__dirname, '../../data/company-profiles.json');
const LOCAL_PROFILES_PATH = path.resolve(__dirname, '../../../data/company-profiles.json');

const ROLE_PREFIXES = {
  SuperAdmin: 'ADM',
  Admin: 'ADM',
  HR: 'HR',
  Employee: 'EMP',
  Intern: 'INT',
};

class UserService {
  constructor() {
    this.ensureDataFiles();
  }

  ensureDataFiles() {
    const defaultData = {
      profiles: [
        {
          id: 'usr-admin-1',
          user_code: 'admin0001',
          user_id: 'usr-admin-1',
          name: 'admin0001',
          email: 'admin@puvima.com',
          role: 'SuperAdmin',
          department: 'Executive Board',
          password: 'Puvima@1818',
          is_active: true,
          created_at: '2026-09-08T00:00:00.000Z'
        },
        {
          id: 'usr-admin-2',
          user_code: 'admin',
          user_id: 'usr-admin-2',
          name: 'admin',
          email: 'admin@puvima.com',
          role: 'Admin',
          department: 'Executive Administration',
          password: 'admin123',
          is_active: true,
          created_at: '2026-09-08T00:00:00.000Z'
        },
        {
          id: 'usr-hr-1',
          user_code: 'HR0001',
          user_id: 'usr-hr-1',
          name: 'puvima hr',
          email: 'hr@puvima.com',
          role: 'HR',
          department: 'Human Resources',
          password: 'hr123',
          is_active: true,
          created_at: '2026-11-08T06:55:00.000Z'
        }
      ]
    };

    [BACKEND_PROFILES_PATH, LOCAL_PROFILES_PATH].forEach((targetPath) => {
      try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, JSON.stringify(defaultData, null, 2), 'utf8');
        }
      } catch (err) {
        console.warn('[UserService] File init notice:', err.message);
      }
    });
  }

  readProfiles() {
    try {
      if (fs.existsSync(BACKEND_PROFILES_PATH)) {
        const raw = fs.readFileSync(BACKEND_PROFILES_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles)) return parsed.profiles;
      }
    } catch (e) {}

    try {
      if (fs.existsSync(LOCAL_PROFILES_PATH)) {
        const raw = fs.readFileSync(LOCAL_PROFILES_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles)) return parsed.profiles;
      }
    } catch (e) {}

    return [];
  }

  saveProfiles(profiles) {
    const payload = JSON.stringify({ profiles }, null, 2);
    [BACKEND_PROFILES_PATH, LOCAL_PROFILES_PATH].forEach((targetPath) => {
      try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetPath, payload, 'utf8');
      } catch (e) {}
    });
  }

  generateUserCode(role, existingProfiles) {
    const prefix = ROLE_PREFIXES[role] || 'EMP';
    const roleProfiles = existingProfiles.filter((p) => p.user_code && p.user_code.startsWith(prefix));

    let maxNum = 0;
    roleProfiles.forEach((p) => {
      const numStr = p.user_code.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async getAllProfiles(query = {}) {
    const profiles = this.readProfiles();
    let result = profiles;

    if (query.role && query.role !== 'all') {
      result = result.filter((p) => String(p.role).toLowerCase() === String(query.role).toLowerCase());
    }

    if (query.department) {
      result = result.filter((p) => p.department === query.department);
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.email && p.email.toLowerCase().includes(s)) ||
          (p.user_code && p.user_code.toLowerCase().includes(s))
      );
    }

    return result;
  }

  async createProfile(data) {
    if (!data.name || !data.email) {
      throw new Error('Name and email are required fields.');
    }

    const profiles = this.readProfiles();
    const cleanEmail = String(data.email).trim().toLowerCase();

    // Check if email already in use
    const existing = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`An account with email ${cleanEmail} already exists (${existing.user_code}).`);
    }

    const role = data.role || 'Employee';
    const userCode = this.generateUserCode(role, profiles);
    const uuid = crypto.randomUUID();

    const newProfile = {
      id: uuid,
      user_code: userCode,
      user_id: uuid,
      name: String(data.name).trim(),
      email: cleanEmail,
      role: role,
      department: data.department || 'General',
      password: data.password ? String(data.password).trim() : 'Password123!',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    profiles.unshift(newProfile);
    this.saveProfiles(profiles);

    return newProfile;
  }

  async toggleActive(idOrCode) {
    const profiles = this.readProfiles();
    const target = profiles.find((p) => p.id === idOrCode || p.user_code === idOrCode);
    if (!target) throw new Error('User not found.');

    target.is_active = !target.is_active;
    target.updated_at = new Date().toISOString();

    this.saveProfiles(profiles);
    return target;
  }
}

module.exports = new UserService();
