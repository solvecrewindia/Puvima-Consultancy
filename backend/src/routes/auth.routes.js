/**
 * PUVIMA Consultancy — Auth & MFA API Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const adminAuth = require('../middleware/adminAuth');
const { mfaRateLimiter } = require('../middleware/rateLimiter');

// MFA status query
router.get('/auth/mfa/status', (req, res) => authController.checkMfaStatus(req, res));

// MFA enrollment & activation (requires existing authenticated session)
router.post('/auth/mfa/enroll', adminAuth, (req, res) => authController.enrollMfa(req, res));
router.post('/auth/mfa/activate', adminAuth, (req, res) => authController.activateMfa(req, res));

// MFA verification during two-factor login flow (rate-limited)
router.post('/auth/mfa/verify', mfaRateLimiter, (req, res) => authController.verifyMfa(req, res));

// Token revocation & logout
router.post('/auth/logout', (req, res) => authController.logout(req, res));

module.exports = router;

