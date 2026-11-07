/**
 * PUVIMA Consultancy — Portal Authentication & RBAC Middleware
 * Validates either JWT token or portal session headers, enforcing role access.
 * Rejects Employee and Intern accounts from administrative endpoints with 403 Forbidden.
 */

const { verifyToken } = require('../utils/token');

function authenticatePortalUser(req) {
  // 1. Check Bearer token or x-admin-token or query param / cookie token
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  } else if (req.query && (req.query.token || req.query.admin_token)) {
    token = req.query.token || req.query.admin_token;
  } else if (req.cookies && (req.cookies.puvima_admin_token || req.cookies.token)) {
    token = req.cookies.puvima_admin_token || req.cookies.token;
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const roleStr = String(payload.role || 'admin').toLowerCase().replace(/[\s_-]+/g, '');
      let mappedRole = 'SuperAdmin';
      if (roleStr === 'hr' || roleStr === 'hrcoordinator') mappedRole = 'HR';
      else if (roleStr === 'employee') mappedRole = 'Employee';
      else if (roleStr === 'intern') mappedRole = 'Intern';
      else if (roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'administrator') mappedRole = 'SuperAdmin';

      return {
        id: payload.id || 'admin_jwt',
        userId: payload.userId || 'admin',
        name: payload.name || payload.username || 'System Administrator',
        role: mappedRole,
        authMethod: 'jwt'
      };
    }
  }

  // 2. Check Portal Session Headers or Query Parameters
  const portalRole = req.headers['x-portal-user-role'] || (req.query && (req.query.role || req.query.portal_role));
  const portalId = req.headers['x-portal-user-id'] || (req.query && (req.query.userId || req.query.id || req.query.user_id));
  const portalName = req.headers['x-portal-user-name'] || (req.query && (req.query.userName || req.query.name || req.query.user_name));

  if (portalRole) {
    const cleanRoleStr = String(portalRole).trim().toLowerCase().replace(/[\s_-]+/g, '');
    let mappedRole = portalRole;
    if (cleanRoleStr === 'hr' || cleanRoleStr === 'hrcoordinator') mappedRole = 'HR';
    else if (cleanRoleStr === 'superadmin' || cleanRoleStr === 'admin') mappedRole = cleanRoleStr === 'admin' ? 'Admin' : 'SuperAdmin';
    else if (cleanRoleStr === 'employee') mappedRole = 'Employee';
    else if (cleanRoleStr === 'intern') mappedRole = 'Intern';

    return {
      id: portalId || 'user_' + cleanRoleStr,
      userId: portalId || 'user_' + cleanRoleStr,
      name: portalName ? decodeURIComponent(portalName) : (mappedRole + ' User'),
      role: mappedRole,
      authMethod: req.headers['x-portal-user-role'] ? 'portal_header' : 'portal_query'
    };
  }

  return null;
}

function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    const user = authenticatePortalUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this portal resource.'
      });
    }

    const normalizedUserRole = String(user.role || '').toLowerCase().replace(/[\s_-]+/g, '');

    // Explicitly reject Employee and Intern roles from management endpoints with 403
    if (normalizedUserRole === 'employee' || normalizedUserRole === 'intern') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges for this operation.'
      });
    }

    const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase().replace(/[\s_-]+/g, ''));

    // SuperAdmin has access everywhere; Admin has access to HR as well
    const isSuperAdmin = normalizedUserRole === 'superadmin';
    const isAdmin = normalizedUserRole === 'admin';
    const hasRole =
      normalizedAllowed.includes(normalizedUserRole) ||
      (isSuperAdmin && (normalizedAllowed.includes('admin') || normalizedAllowed.includes('hr'))) ||
      (isAdmin && normalizedAllowed.includes('hr'));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Role unauthorized to access this resource.'
      });
    }

    req.user = user;
    req.admin = user; // Backwards compatibility for req.admin
    next();
  };
}

module.exports = {
  authenticatePortalUser,
  requireRoles,
  requireHrOrAdmin: requireRoles(['HR', 'Admin', 'SuperAdmin']),
  requireSuperAdminOrAdmin: requireRoles(['Admin', 'SuperAdmin'])
};

