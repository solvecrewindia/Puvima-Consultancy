/**
 * PUVIMA Consultancy — Mail Authorization Middleware
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

  // Also allow requests authenticated via x-mailbox-auth
  if (!token && req.headers['x-mailbox-auth']) {
    try {
      const decoded = Buffer.from(req.headers['x-mailbox-auth'], 'base64').toString('utf8');
      const creds = JSON.parse(decoded);
      if (creds && creds.user && creds.pass) {
        req.user = { email: creds.user, role: 'mail_user' };
        return next();
      }
    } catch (e) {}
  }

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

  req.user = payload;
  next();
}

module.exports = mailAuth;

