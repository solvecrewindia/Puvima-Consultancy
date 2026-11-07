/**
 * PUVIMA Consultancy — Enterprise Multi-Factor Authentication (MFA / TOTP) Service
 * Implements RFC 6238 Time-Based One-Time Passwords (TOTP) compatible with
 * Google Authenticator, Microsoft Authenticator, and Authy.
 * Generates single-use hashed recovery codes and enforces server-side verification.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const DATA_DIR = path.resolve(__dirname, '../../../data');
const BACKEND_DATA_DIR = path.resolve(__dirname, '../../data');
const MFA_FILE = path.join(DATA_DIR, 'mfa-credentials.json');
const BACKEND_MFA_FILE = path.join(BACKEND_DATA_DIR, 'mfa-credentials.json');

const TIME_STEP_SECONDS = 30;
const DIGITS = 6;

// Base32 charset RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(base32Str) {
  const clean = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Computes RFC 6238 TOTP code for a secret at a specific counter step
 */
function computeTotp(secretBuffer, timeStep) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % Math.pow(10, DIGITS);

  return String(code).padStart(DIGITS, '0');
}

class MfaService {
  constructor() {
    this.ensureDataFiles();
  }

  ensureDataFiles() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(BACKEND_DATA_DIR)) fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });

      if (!fs.existsSync(MFA_FILE)) {
        fs.writeFileSync(MFA_FILE, JSON.stringify({ enrollments: {} }, null, 2), 'utf8');
      }
      if (!fs.existsSync(BACKEND_MFA_FILE)) {
        fs.writeFileSync(BACKEND_MFA_FILE, JSON.stringify({ enrollments: {} }, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  readLocalStore() {
    try {
      const f = fs.existsSync(MFA_FILE) ? MFA_FILE : (fs.existsSync(BACKEND_MFA_FILE) ? BACKEND_MFA_FILE : null);
      if (f) {
        const raw = fs.readFileSync(f, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return { enrollments: {} };
  }

  writeLocalStore(data) {
    try {
      const json = JSON.stringify(data, null, 2);
      if (fs.existsSync(DATA_DIR)) fs.writeFileSync(MFA_FILE, json, 'utf8');
      if (fs.existsSync(BACKEND_DATA_DIR)) fs.writeFileSync(BACKEND_MFA_FILE, json, 'utf8');
    } catch (e) {}
  }

  /**
   * Generates a new TOTP secret and enrollment URI
   * @param {string} userIdentifier (e.g. email or user_code)
   * @param {string} issuer (PUVIMA Consultancy)
   */
  generateEnrollment(userIdentifier, issuer = 'PUVIMA Consultancy') {
    const rawSecret = crypto.randomBytes(20);
    const secretBase32 = base32Encode(rawSecret);

    // Generate 8 single-use recovery codes
    const recoveryCodes = [];
    const hashedRecoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      const code = `PUV-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      recoveryCodes.push(code);
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      hashedRecoveryCodes.push(hash);
    }

    const cleanLabel = encodeURIComponent(`${issuer}:${userIdentifier}`);
    const cleanIssuer = encodeURIComponent(issuer);
    const otpauthUrl = `otpauth://totp/${cleanLabel}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=${DIGITS}&period=${TIME_STEP_SECONDS}`;

    return {
      secret: secretBase32,
      otpauthUrl,
      recoveryCodes,
      hashedRecoveryCodes
    };
  }

  /**
   * Confirms and activates MFA enrollment after user proves they can produce a valid code
   */
  async activateEnrollment(userId, secretBase32, code, hashedRecoveryCodes) {
    const verified = this.verifyCode(secretBase32, code);
    if (!verified) {
      return { success: false, message: 'Invalid 6-digit verification code. Please check your authenticator app.' };
    }

    // Save activation
    const store = this.readLocalStore();
    store.enrollments[userId] = {
      userId,
      secret: secretBase32,
      recoveryCodes: hashedRecoveryCodes,
      activatedAt: new Date().toISOString(),
      enabled: true
    };
    this.writeLocalStore(store);

    // Attempt MySQL update if table exists
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        await db.query(
          `INSERT INTO mfa_credentials (user_id, secret, recovery_codes, is_enabled, activated_at)
           VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE secret = VALUES(secret), recovery_codes = VALUES(recovery_codes), is_enabled = 1, activated_at = CURRENT_TIMESTAMP`,
          [userId, secretBase32, JSON.stringify(hashedRecoveryCodes)]
        );
      }
    } catch (e) {}

    return { success: true, message: 'Multi-factor authentication successfully enabled.' };
  }

  /**
   * Verifies a 6-digit TOTP code with ±1 step clock skew tolerance
   */
  verifyCode(secretBase32, userCode) {
    if (!secretBase32 || !userCode) return false;
    const cleanCode = String(userCode).trim().replace(/\s+/g, '');
    if (cleanCode.length !== DIGITS) return false;

    const secretBuf = base32Decode(secretBase32);
    const currentStep = Math.floor(Date.now() / 1000 / TIME_STEP_SECONDS);

    // Check window: current, -1, and +1 step
    for (let offset = -1; offset <= 1; offset++) {
      const candidate = computeTotp(secretBuf, currentStep + offset);
      if (candidate === cleanCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if MFA is required or active for a user
   */
  async isMfaActive(userId) {
    const store = this.readLocalStore();
    const entry = store.enrollments[userId];
    if (entry && entry.enabled) return true;

    // Check MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const rows = await db.query('SELECT is_enabled FROM mfa_credentials WHERE user_id = ? LIMIT 1', [userId]);
        if (rows && rows.length > 0 && rows[0].is_enabled) return true;
      }
    } catch (e) {}

    return false;
  }

  /**
   * Verify an enrolled user's authentication step via TOTP or single-use recovery code
   */
  async verifyUserLogin(userId, codeOrRecovery) {
    const cleanInput = String(codeOrRecovery).trim();
    const store = this.readLocalStore();
    const entry = store.enrollments[userId];

    if (!entry || !entry.enabled) {
      return { success: false, message: 'MFA is not enabled for this user.' };
    }

    // 1. Try TOTP code (6 digits)
    if (/^\d{6}$/.test(cleanInput)) {
      const valid = this.verifyCode(entry.secret, cleanInput);
      if (valid) {
        return { success: true, method: 'totp' };
      }
    }

    // 2. Try Recovery Code
    const inputHash = crypto.createHash('sha256').update(cleanInput.toUpperCase()).digest('hex');
    const recoveryIndex = (entry.recoveryCodes || []).indexOf(inputHash);

    if (recoveryIndex !== -1) {
      // Consume single-use code
      entry.recoveryCodes.splice(recoveryIndex, 1);
      this.writeLocalStore(store);

      return {
        success: true,
        method: 'recovery_code',
        remainingCodesCount: entry.recoveryCodes.length
      };
    }

    return { success: false, message: 'Invalid authentication code or recovery key.' };
  }
}

module.exports = new MfaService();

