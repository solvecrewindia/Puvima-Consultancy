/**
 * Puvima IT Service and Research Consultancy — Onboarding Authentication & Role Authorization Middleware
 */

const { verifyToken } = require('../utils/token');

function requireHrRole(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  } else if (req.headers['x-hr-token']) {
    token = req.headers['x-hr-token'];
  }

  // Also support session check from query token for direct window openings
  if (!token && req.query.hr_token) {
    token = req.query.hr_token;
  }

  // 1. Direct portal role headers (e.g. x-portal-user-role: HR)
  const portalRole = String(req.headers['x-portal-user-role'] || '').toLowerCase();
  if (['admin', 'superadmin', 'hr'].includes(portalRole)) {
    req.hrUser = {
      id: req.headers['x-portal-user-id'] || 'HR_PORTAL',
      name: req.headers['x-portal-user-name'] || 'HR Reviewer',
      role: portalRole,
      email: req.headers['x-portal-user-email'] || 'hr@puvima.com'
    };
    return next();
  }

  if (!token && !req.headers['x-portal-user'] && !req.headers['x-company-user']) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: HR or Administrative authentication token required.'
    });
  }

  const payload = verifyToken(token);
  const role = payload ? String(payload.role || '').toLowerCase() : '';

  if (payload && ['admin', 'superadmin', 'hr'].includes(role)) {
    req.hrUser = payload;
    return next();
  }

  // Support authenticated company portal session headers (e.g. from HR portal client)
  try {
    const sessionHeader = req.headers['x-portal-user'] || req.headers['x-company-user'];
    if (sessionHeader) {
      const u = JSON.parse(decodeURIComponent(sessionHeader));
      const uRole = String(u.role || '').toLowerCase();
      if (['admin', 'superadmin', 'hr'].includes(uRole)) {
        req.hrUser = {
          id: u.id || u.userId || u.user_code || 'HR_PORTAL',
          name: u.name || 'HR Reviewer',
          role: uRole,
          email: u.email || 'hr@puvima.com'
        };
        return next();
      }
    }
  } catch (e) {}

  return res.status(403).json({
    success: false,
    message: 'Access restricted: You do not have permissions to perform HR onboarding verification.'
  });
}

function requireApplicantAccess(req, res, next) {
  const token = req.headers['x-onboarding-token'] || (req.query && req.query.token);
  const portalRole = String(req.headers['x-portal-user-role'] || '').toLowerCase();

  if (['admin', 'superadmin', 'hr'].includes(portalRole) || req.headers['authorization']) {
    return next();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Onboarding access token is required.'
    });
  }
  req.onboardingToken = token;
  next();
}

module.exports = {
  requireHrRole,
  requireApplicantAccess,
  requireOnboardingOwner: requireApplicantAccess
};
