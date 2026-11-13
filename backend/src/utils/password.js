/**
 * Puvima IT Service and Research Consultancy — Enterprise Password Security & Cryptographic Hashing Utility
 * Implements OWASP ASVS compliant scrypt password hashing with cryptographically random salts,
 * constant-time verification against timing attacks, and automatic legacy password migration.
 */

const crypto = require('crypto');

// Scrypt recommended parameters for interactive logins (OWASP Password Storage Cheat Sheet)
const SCRYPT_COST = 16384;      // N (CPU/memory cost)
const SCRYPT_BLOCK_SIZE = 8;     // r
const SCRYPT_PARALLELISM = 1;    // p
const SCRYPT_KEY_LENGTH = 64;    // Output key length (bytes)
const SALT_LENGTH = 32;          // Salt length (bytes)

// Common compromised passwords list (OWASP Top 10 A07:2021)
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'admin', 'admin123', '123456', '12345678',
  '123456789', 'welcome', 'welcome123', 'puvima', 'puvima123', 'qwerty',
  'qwerty123', 'letmein', 'changeme', 'iloveyou', 'secret', 'default'
]);

/**
 * Hash a plain password using cryptographic scrypt with a unique random salt
 * @param {string} plainPassword 
 * @returns {Promise<string>} Formatted hash: scrypt$N=16384,r=8,p=1$salt$hash
 */
function hashPassword(plainPassword) {
  return new Promise((resolve, reject) => {
    if (!plainPassword || typeof plainPassword !== 'string') {
      return reject(new Error('Password must be a non-empty string.'));
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const options = {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELISM,
      maxmem: 32 * 1024 * 1024
    };

    crypto.scrypt(plainPassword, salt, SCRYPT_KEY_LENGTH, options, (err, derivedKey) => {
      if (err) return reject(err);
      const saltHex = salt.toString('hex');
      const hashHex = derivedKey.toString('hex');
      const formatted = `scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELISM}$${saltHex}$${hashHex}`;
      resolve(formatted);
    });
  });
}

/**
 * Synchronous hash helper for configuration/setup
 * @param {string} plainPassword 
 * @returns {string} Formatted scrypt hash
 */
function hashPasswordSync(plainPassword) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const options = {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: 32 * 1024 * 1024
  };
  const derivedKey = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH, options);
  return `scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELISM}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Timing-safe comparison of two string buffers to prevent timing side-channel attacks
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to equalize timing
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a plain password against a stored hash or legacy plaintext string.
 * Uses timing-safe verification.
 * @param {string} plainPassword 
 * @param {string} storedHashOrPlain 
 * @returns {Promise<boolean>}
 */
function verifyPassword(plainPassword, storedHashOrPlain) {
  return new Promise((resolve) => {
    if (!plainPassword || !storedHashOrPlain) {
      return resolve(false);
    }

    // Case 1: Scrypt hash format
    if (storedHashOrPlain.startsWith('scrypt$')) {
      const parts = storedHashOrPlain.split('$');
      if (parts.length !== 4) {
        return resolve(false);
      }

      const [, paramsStr, saltHex, expectedHashHex] = parts;
      const salt = Buffer.from(saltHex, 'hex');
      const expectedHash = Buffer.from(expectedHashHex, 'hex');

      // Parse parameters
      const params = {};
      paramsStr.split(',').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k && v) params[k] = parseInt(v, 10);
      });

      const options = {
        N: params.N || SCRYPT_COST,
        r: params.r || SCRYPT_BLOCK_SIZE,
        p: params.p || SCRYPT_PARALLELISM,
        maxmem: 32 * 1024 * 1024
      };

      crypto.scrypt(plainPassword, salt, expectedHash.length, options, (err, derivedKey) => {
        if (err || !derivedKey) {
          return resolve(false);
        }

        const valid = derivedKey.length === expectedHash.length && crypto.timingSafeEqual(derivedKey, expectedHash);
        resolve(valid);
      });
      return;
    }

    // Case 2: Legacy plaintext comparison (timing-safe)
    const matchesLegacy = safeEqual(plainPassword, storedHashOrPlain);
    resolve(matchesLegacy);
  });
}

/**
 * Verifies password and checks if it needs upgrade to scrypt
 * @param {string} plainPassword 
 * @param {string} storedHashOrPlain 
 * @returns {Promise<{ valid: boolean, needsRehash: boolean }>}
 */
async function verifyPasswordDetailed(plainPassword, storedHashOrPlain) {
  const valid = await verifyPassword(plainPassword, storedHashOrPlain);
  const isScrypt = typeof storedHashOrPlain === 'string' && storedHashOrPlain.startsWith('scrypt$');
  return {
    valid,
    needsRehash: valid && !isScrypt
  };
}

/**
 * Validate password complexity and strength
 * @param {string} password 
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'] };
  }

  if (password.length < 10) {
    errors.push('Password must be at least 10 characters in length.');
  }
  if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit (0-9).');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  const normalized = password.toLowerCase();
  for (const common of COMMON_PASSWORDS) {
    if (normalized === common || normalized.includes(common + '123') || normalized.includes(common + '!')) {
      errors.push('Password is too common or easily guessable. Please choose a more complex phrase.');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordDetailed,
  safeEqual,
  validatePasswordStrength,
  SCRYPT_COST
};
