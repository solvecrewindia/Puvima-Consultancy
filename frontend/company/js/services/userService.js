/**
 * Puvima IT Service and Research Consultancy — User Management Service
 * Synchronized with server-side /api/company/users and resilient local cache.
 */

const UserService = (function () {
  const STORE_KEY = 'puvima_portal_profiles';

  function getLocalUsers() {
    try {
      const data = localStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalUsers(users) {
    localStorage.setItem(STORE_KEY, JSON.stringify(users));
  }

  function generateUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function generateUserCode(role, existingUsers) {
    const prefix = (window.CONFIG && window.CONFIG.USER_CODE_PREFIXES[role]) || 'EMP';
    const roleUsers = existingUsers.filter((u) => u.user_code && u.user_code.startsWith(prefix));

    let maxNum = 0;
    roleUsers.forEach((u) => {
      const numStr = u.user_code.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async function getUsers(options = {}) {
    const { role, roles, isActive, search, department } = options;
    let list = [];

    // 1. Try Backend API first for live synchronization
    try {
      const res = await fetch('/api/company/users');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.users) && json.users.length > 0) {
          list = json.users;
          saveLocalUsers(list);
        }
      }
    } catch (netErr) {
      console.warn('[UserService] Live server sync notice, falling back to local cache:', netErr);
    }

    // 2. Fallback to local store if server was unreachable
    if (list.length === 0) {
      list = getLocalUsers();
    }

    if (roles && roles.length > 0) {
      const lowRoles = roles.map((r) => String(r).toLowerCase());
      list = list.filter((u) => lowRoles.includes(String(u.role).toLowerCase()));
    } else if (role) {
      list = list.filter((u) => String(u.role).toLowerCase() === String(role).toLowerCase());
    }

    if (typeof isActive === 'boolean') {
      list = list.filter((u) => u.is_active === isActive);
    }

    if (department) {
      list = list.filter((u) => u.department === department);
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(s)) ||
          (u.email && u.email.toLowerCase().includes(s)) ||
          (u.user_code && u.user_code.toLowerCase().includes(s))
      );
    }

    return list;
  }

  async function getUserById(id) {
    const users = await getUsers();
    return users.find((u) => u.id === id || u.user_code === id) || null;
  }

  async function createUser(userData) {
    // 1. Try Backend API first
    try {
      const res = await fetch('/api/company/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Server rejected user creation.');
      }

      const created = json.user;
      const local = getLocalUsers();
      local.unshift(created);
      saveLocalUsers(local);
      return created;
    } catch (err) {
      console.warn('[UserService] Server user creation failed or offline, saving locally:', err.message);

      // Local fallback
      const users = getLocalUsers();
      const userCode = generateUserCode(userData.role, users);
      const uuid = generateUuid();

      const newUser = {
        id: uuid,
        user_code: userCode,
        user_id: uuid,
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        role: userData.role,
        department: userData.department || 'General',
        password: userData.password ? userData.password.trim() : 'Password123!',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      users.unshift(newUser);
      saveLocalUsers(users);
      return newUser;
    }
  }

  async function toggleUserStatus(id) {
    try {
      const res = await fetch(`/api/company/users/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          const local = getLocalUsers();
          const idx = local.findIndex((u) => u.id === id || u.user_code === id);
          if (idx !== -1) {
            local[idx] = json.user;
            saveLocalUsers(local);
          }
          return json.user;
        }
      }
    } catch (e) {}

    // Fallback
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === id || u.user_code === id);
    if (idx === -1) throw new Error('User not found.');

    users[idx].is_active = !users[idx].is_active;
    users[idx].updated_at = new Date().toISOString();

    saveLocalUsers(users);
    return users[idx];
  }

  return {
    getUsers,
    getUserById,
    createUser,
    toggleUserStatus,
  };
})();

if (typeof window !== 'undefined') {
  window.UserService = UserService;
}
