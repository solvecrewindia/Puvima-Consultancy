/**
 * Puvima IT Service and Research Consultancy — Enterprise JWT Security & Token Utility
 * Built-in HMAC-SHA256 token generation, timing-safe verification,
 * explicit algorithm validation, and in-memory session revocation support.
 */

const crypto = require('crypto');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'puvima_enterprise_admin_secure_secret_2026';
const TOKEN_TTL_SECONDS = parseInt(process.env.JWT_TTL_SECONDS, 10) || 24 * 60 * 60; // 24 hours

// Revocation registry: stores revoked jti / token hashes until their expiration
const revokedTokens = new Map(); // tokenHash -> expiresAt

// Periodic cleanup of expired revoked tokens
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [hash, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(hash);
    }
  }
}, 15 * 60 * 1000).unref();

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Generates a signed HMAC-SHA256 JWT
 * @param {Object} payload 
 * @param {Object} options 
 * @returns {string} Signed JWT
 */
function signToken(payload, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const ttl = options.expiresInSeconds || TOKEN_TTL_SECONDS;
  const jti = options.jti || crypto.randomBytes(16).toString('hex');

  const fullPayload = {
    ...payload,
    iss: 'puvima-consultancy',
    aud: 'puvima-portal',
    jti,
    iat: now,
    exp: now + ttl
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest());

  return `${signatureInput}.${signature}`;
}

/**
 * Timing-safe HMAC signature verification and claim validation
 * @param {string} token 
 * @returns {Object|null} Verified payload or null if invalid/revoked/expired
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  // Check revocation registry
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (revokedTokens.has(tokenHash)) {
    return null; // Revoked
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  // Validate Header: Must be valid base64 JSON with alg === 'HS256'
  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (!header || header.alg !== 'HS256') {
      return null; // Reject 'none' or mismatched algorithms
    }
  } catch (e) {
    return null;
  }

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());

  // Timing-safe signature comparison
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    // Validate expiration
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Validate not-before (nbf) if present
    if (payload.nbf && payload.nbf > now) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Revoke a token (for logout, password change, or session termination)
 * @param {string} token 
 * @returns {boolean}
 */
function revokeToken(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const exp = payload.exp || (Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    revokedTokens.set(tokenHash, exp);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a token has been explicitly revoked
 * @param {string} token 
 * @returns {boolean}
 */
function isTokenRevoked(token) {
  if (!token) return true;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return revokedTokens.has(tokenHash);
}

module.exports = {
  signToken,
  verifyToken,
  revokeToken,
  isTokenRevoked,
  TOKEN_TTL_SECONDS
};
