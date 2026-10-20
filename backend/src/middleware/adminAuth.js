/**
 * PUVIMA Consultancy — Admin Authentication Middleware
 */

const { verifyToken } = require('../utils/token');

function adminAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Admin authentication token required.'
    });
  }

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Invalid or expired admin session. Please log in again.'
    });
  }

  req.admin = payload;
  next();
}

module.exports = adminAuth;
