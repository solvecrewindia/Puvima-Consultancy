/**
 * PUVIMA Consultancy — User Management Service
 * Handles user profiles, role prefixes, deactivations, and listings
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

    if (window.portalClient && window.portalClient.supabase) {
      try {
        let q = window.portalClient.supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (roles && roles.length > 0) {
          q = q.in('role', roles);
        } else if (role) {
          q = q.eq('role', role);
        }

        if (typeof isActive === 'boolean') {
          q = q.eq('is_active', isActive);
        }

        if (department) {
          q = q.eq('department', department);
        }

        if (search && search.trim()) {
          const s = search.trim();
          q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,user_code.ilike.%${s}%`);
        }

        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        console.warn('[UserService] Supabase error, using local data:', e);
      }
    }

    // Local Store Filtering
    let list = getLocalUsers();

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
    const users = getLocalUsers();
    const userCode = generateUserCode(userData.role, users);

    const newUser = {
      id: 'usr-' + Date.now(),
      user_code: userCode,
      user_id: 'usr-' + Date.now(),
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      department: userData.department || 'General',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try Supabase insert
    if (window.portalClient && window.portalClient.supabase) {
      try {
        await window.portalClient.supabase.from('profiles').insert([newUser]);
      } catch (e) {
        console.warn('[UserService] Supabase insert failed, saved to local cache:', e);
      }
    }

    users.unshift(newUser);
    saveLocalUsers(users);
    return newUser;
  }

  async function updateUser(id, updates) {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === id || u.user_code === id);
    if (idx === -1) throw new Error('User not found.');

    users[idx] = {
      ...users[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    saveLocalUsers(users);
    return users[idx];
  }

  async function toggleUserStatus(id) {
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
    updateUser,
    toggleUserStatus,
  };
})();

if (typeof window !== 'undefined') {
  window.UserService = UserService;
}
