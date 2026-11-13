/**
 * Puvima IT Service and Research Consultancy — Mail Authorization Middleware
 * Verifies valid admin or authorized company executive session tokens.
 */

const { verifyToken } = require('../utils/token');

function mailAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  } else if (req.headers['x-mail-token']) {
    token = req.headers['x-mail-token'];
  } else if (req.query && req.query.token) {
    // Allowed for safe inline attachment downloads
    token = req.query.token;
  }

  // Reject unauthenticated requests without a valid session token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Authentication required to access PUVIMA Mail.'
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Invalid or expired session. Please log in to PUVIMA.'
    });
  }

  req.token = token;
  req.user = payload;
  next();
}

module.exports = mailAuth;
