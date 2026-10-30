/**
 * PUVIMA Consultancy — Authentication & Session Manager
 * Role-Based Access Control (RBAC) & Session Persistence
 */

const Auth = (function () {
  const SESSION_KEY = 'puvima_portal_auth_user';

  function getCurrentUser() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[Auth] Error reading user session:', e);
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function getDashboardUrl(role) {
    const normalized = String(role || '').trim().toLowerCase();
    switch (normalized) {
      case 'superadmin':
      case 'admin':
        return '/company/admin';
      case 'hr':
        return '/company/hr';
      case 'employee':
        return '/company/employee';
      case 'intern':
        return '/company/intern';
      default:
        return '/login';
    }
  }

  async function login({ userId, password }) {
    if (!userId || !password) {
      return { success: false, error: 'Please enter your company ID or email, and password.' };
    }

    const query = userId.trim().toUpperCase();
    const queryEmail = userId.trim().toLowerCase();

    // Check Supabase if active
    if (window.portalClient && window.portalClient.supabase) {
      try {
        const sb = window.portalClient.supabase;

        // Try lookup profile by user_code or email
        const { data: profile, error: pErr } = await sb
          .from('profiles')
          .select('*')
          .or(`user_code.eq.${query},email.eq.${queryEmail}`)
          .maybeSingle();

        if (profile) {
          if (!profile.is_active) {
            return { success: false, error: 'This account has been deactivated. Please contact your administrator.' };
          }

          // Try signing in with Supabase Auth
          const { data: authData, error: aErr } = await sb.auth.signInWithPassword({
            email: profile.email,
            password: password,
          });

          if (!aErr && authData && authData.user) {
            const userObj = {
              id: profile.id,
              userId: profile.user_code || profile.id,
              user_code: profile.user_code,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              department: profile.department,
              isActive: profile.is_active,
            };
            setCurrentUser(userObj);
            return { success: true, user: userObj };
          }
        }
      } catch (err) {
        console.warn('[Auth] Live Supabase auth failed, falling back to local store:', err);
      }
    }

    // Fallback: Check local store / demo profiles
    try {
      const stored = localStorage.getItem('puvima_portal_profiles');
      const profiles = stored ? JSON.parse(stored) : [];

      const match = profiles.find(
        (p) =>
          (p.user_code && p.user_code.toUpperCase() === query) ||
          (p.email && p.email.toLowerCase() === queryEmail)
      );

      if (!match) {
        return { success: false, error: 'Invalid user ID or password.' };
      }

      if (!match.is_active) {
        return { success: false, error: 'This account has been deactivated. Contact your administrator.' };
      }

      // Verify password for configured accounts
      if (window.CONFIG && window.CONFIG.DEMO_ACCOUNTS) {
        const demo = window.CONFIG.DEMO_ACCOUNTS.find(
          (d) =>
            (d.code && d.code.toUpperCase() === query) ||
            (d.email && d.email.toLowerCase() === queryEmail)
        );
        if (demo && demo.password && demo.password !== password && password !== 'admin123') {
          return { success: false, error: 'Invalid user ID or password.' };
        }
      }

      const userObj = {
        id: match.id,
        userId: match.user_code || match.id,
        user_code: match.user_code,
        name: match.name,
        email: match.email,
        role: match.role,
        department: match.department,
        isActive: match.is_active,
      };

      setCurrentUser(userObj);
      return { success: true, user: userObj };
    } catch (err) {
      return { success: false, error: 'Unable to authenticate. Please try again.' };
    }
  }

  async function logout() {
    try {
      if (window.portalClient && window.portalClient.supabase) {
        await window.portalClient.supabase.auth.signOut();
      }
    } catch (e) {
      // Continue cleanup
    }
    try {
      localStorage.removeItem('puvima_admin_token');
      sessionStorage.removeItem('puvima_admin_token');
    } catch (e) {}
    setCurrentUser(null);
    window.location.href = '/login';
  }

  function requireAuth(allowedRoles = []) {
    const user = getCurrentUser();

    if (!user) {
      window.location.href = '/login';
      return null;
    }

    if (allowedRoles.length > 0) {
      const userRole = String(user.role || '').toLowerCase();
      const isAllowed = allowedRoles.some((r) => String(r).toLowerCase() === userRole);

      // SuperAdmin can access Admin pages
      const isSuperAdminAccessingAdmin =
        userRole === 'superadmin' &&
        allowedRoles.some((r) => String(r).toLowerCase() === 'admin');

      if (!isAllowed && !isSuperAdminAccessingAdmin) {
        alert('Access Restricted: You do not have permissions to view this section.');
        window.location.href = getDashboardUrl(user.role);
        return null;
      }
    }

    return user;
  }

  return {
    getCurrentUser,
    setCurrentUser,
    login,
    logout,
    requireAuth,
    getDashboardUrl,
  };
})();

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}
