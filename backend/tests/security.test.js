/**
 * Puvima IT Service and Research Consultancy — Enterprise Security Test Suite
 * Validates password hashing, timing-safe tokens, rate limiters, SSRF guard, TOTP MFA, and audit logging.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { hashPassword, verifyPassword, verifyPasswordDetailed, validatePasswordStrength } = require('../src/utils/password');
const { signToken, verifyToken, revokeToken, isTokenRevoked } = require('../src/utils/token');
const { validateOutboundHost, isPrivateOrBlockedIP, isPrivateOrReservedIp } = require('../src/utils/ssrfGuard');
const mfaService = require('../src/services/mfa.service');
const auditService = require('../src/services/audit.service');
const app = require('../src/app');

describe('Enterprise Security & Hardening Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // 1. Password Hashing & Strength
  test('Password utility hashes passwords with scrypt and verifies timing-safely', async () => {
    const rawPass = 'PuvimaSecure#2026';
    const hash = await hashPassword(rawPass);
    assert.ok(hash.startsWith('scrypt$'), 'Hash must have scrypt prefix');

    const validMatch = await verifyPassword(rawPass, hash);
    assert.strictEqual(validMatch, true, 'Valid password must match hash');

    const invalidMatch = await verifyPassword('WrongPassword123!', hash);
    assert.strictEqual(invalidMatch, false, 'Invalid password must be rejected');
  });

  test('Password utility transparently verifies and migrates legacy plaintext passwords', async () => {
    const legacyPass = 'admin123';
    const match = await verifyPassword('admin123', legacyPass);
    assert.strictEqual(match, true);

    const wrongMatch = await verifyPassword('wrongpass', legacyPass);
    assert.strictEqual(wrongMatch, false);

    const detailed = await verifyPasswordDetailed('admin123', legacyPass);
    assert.strictEqual(detailed.valid, true);
    assert.strictEqual(detailed.needsRehash, true);
  });

  test('Password strength validator enforces complexity and rejects weak dictionary passwords', () => {
    const weakCheck = validatePasswordStrength('password123');
    assert.strictEqual(weakCheck.valid, false);
    assert.ok(weakCheck.errors.length > 0);

    const shortCheck = validatePasswordStrength('Ab1!');
    assert.strictEqual(shortCheck.valid, false);

    const strongCheck = validatePasswordStrength('SuperSecure#Puvima2026!');
    assert.strictEqual(strongCheck.valid, true);
    assert.strictEqual(strongCheck.errors.length, 0);
  });

  // 2. JWT Hardening & Token Revocation
  test('JWT utility uses timing-safe HMAC verification and rejects tampered signatures', () => {
    const token = signToken({ email: 'secops@puvima.com', role: 'admin' });
    const payload = verifyToken(token);
    assert.ok(payload);
    assert.strictEqual(payload.email, 'secops@puvima.com');
    assert.strictEqual(payload.role, 'admin');

    // Tampered signature
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignature12345`;
    const invalidPayload = verifyToken(tampered);
    assert.strictEqual(invalidPayload, null, 'Tampered token signature must be rejected');
  });

  test('Token revocation list invalidates revoked tokens immediately', () => {
    const token = signToken({ email: 'revokeme@puvima.com', role: 'admin' });
    assert.strictEqual(isTokenRevoked(token), false);
    assert.ok(verifyToken(token));

    revokeToken(token);
    assert.strictEqual(isTokenRevoked(token), true);
    assert.strictEqual(verifyToken(token), null, 'Revoked token must not verify');
  });

  // 3. SSRF Guard
  test('SSRF Guard blocks loopback, private subnets, and cloud metadata endpoints', async () => {
    assert.strictEqual(isPrivateOrBlockedIP('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('10.0.0.5'), true);
    assert.strictEqual(isPrivateOrBlockedIP('192.168.1.1'), true);
    assert.strictEqual(isPrivateOrBlockedIP('172.16.0.1'), true);
    assert.strictEqual(isPrivateOrBlockedIP('169.254.169.254'), true); // AWS/GCP metadata
    assert.strictEqual(isPrivateOrBlockedIP('::1'), true); // IPv6 loopback

    const loopbackCheck = await validateOutboundHost('127.0.0.1');
    assert.strictEqual(loopbackCheck.valid, false);

    const localhostCheck = await validateOutboundHost('localhost');
    assert.strictEqual(localhostCheck.valid, false);

    const metadataCheck = await validateOutboundHost('169.254.169.254');
    assert.strictEqual(metadataCheck.valid, false);

    const googleCheck = await validateOutboundHost('smtp.gmail.com');
    assert.strictEqual(googleCheck.valid, true);
  });

  // 4. RFC 6238 TOTP Multi-Factor Authentication
  test('MFA service generates RFC 6238 secret, recovery codes, and verifies valid codes', async () => {
    const testUser = 'test_admin_' + Date.now();
    const enrollment = mfaService.generateEnrollment(testUser);
    assert.ok(enrollment.secret);
    assert.ok(enrollment.otpauthUrl.includes(enrollment.secret));
    assert.strictEqual(enrollment.recoveryCodes.length, 8);

    // Invalid code check
    const invalidResult = mfaService.verifyCode(enrollment.secret, '000000');
    assert.strictEqual(invalidResult, false);

    // Activation test with invalid code
    const failActivation = await mfaService.activateEnrollment(testUser, enrollment.secret, '999999', enrollment.hashedRecoveryCodes);
    assert.strictEqual(failActivation.success, false);

    // Single use recovery code verification
    const store = mfaService.readLocalStore();
    store.enrollments[testUser] = {
      userId: testUser,
      secret: enrollment.secret,
      recoveryCodes: enrollment.hashedRecoveryCodes,
      enabled: true
    };
    mfaService.writeLocalStore(store);

    const firstRecoveryCode = enrollment.recoveryCodes[0];
    const recoverResult = await mfaService.verifyUserLogin(testUser, firstRecoveryCode);
    assert.strictEqual(recoverResult.success, true);
    assert.strictEqual(recoverResult.method, 'recovery_code');
    assert.strictEqual(recoverResult.remainingCodesCount, 7);

    // Replay attack with same recovery code must be rejected
    const replayResult = await mfaService.verifyUserLogin(testUser, firstRecoveryCode);
    assert.strictEqual(replayResult.success, false);
  });

  // 5. Audit Logging Service
  test('Audit log service records events and automatically redacts sensitive credentials', async () => {
    const testReq = {
      method: 'POST',
      originalUrl: '/api/admin/login',
      ip: '198.51.100.1',
      headers: { 'user-agent': 'SecurityTestAgent/1.0', authorization: 'Bearer super-secret-jwt-token' }
    };

    const entry = await auditService.log({
      req: testReq,
      action: 'TEST_AUDIT_ACTION',
      category: 'AUTH',
      severity: 'INFO',
      user: { email: 'auditor@puvima.com', role: 'admin' },
      details: {
        password: 'PlainTextPassword123',
        token: 'secret-token-value',
        safeParam: 'public-data'
      }
    });

    assert.ok(entry);
    assert.strictEqual(entry.action, 'TEST_AUDIT_ACTION');
    assert.strictEqual(entry.details.password, '[REDACTED]');
    assert.strictEqual(entry.details.token, '[REDACTED]');
    assert.strictEqual(entry.details.safeParam, 'public-data');
  });

  // 6. Security HTTP Headers
  test('HTTP responses include Helmet security headers and Permissions-Policy', async () => {
    const res = await fetch(`${baseUrl}/api`);
    assert.strictEqual(res.status, 200);

    const xcto = res.headers.get('x-content-type-options');
    assert.strictEqual(xcto, 'nosniff');

    const xfo = res.headers.get('x-frame-options');
    assert.strictEqual(xfo, 'DENY');

    const permPolicy = res.headers.get('permissions-policy');
    assert.ok(permPolicy.includes('camera=()'));
    assert.ok(permPolicy.includes('microphone=()'));
  });

  // 7. Auth Endpoints & Logout
  test('POST /api/auth/logout terminates and revokes session', async () => {
    const testToken = signToken({ email: 'logoutuser@puvima.com', role: 'admin' });

    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(isTokenRevoked(testToken), true);
  });

  test('GET /api/auth/mfa/status checks user MFA status correctly', async () => {
    const res = await fetch(`${baseUrl}/api/auth/mfa/status?userId=admin@puvima.com`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.mfaActive, 'boolean');
  });
});
