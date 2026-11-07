/**
 * PUVIMA Consultancy — Centralized Authentication & MFA Controller
 * Provides MFA enrollment, verification, status check, and session invalidation.
 */

const crypto = require('crypto');
const mfaService = require('../services/mfa.service');
const auditService = require('../services/audit.service');
const { signToken, revokeToken } = require('../utils/token');

class AuthController {
  // GET /api/auth/mfa/status
  async checkMfaStatus(req, res) {
    try {
      const { email, userId } = req.query;
      const targetUser = (userId || email || '').trim().toLowerCase();

      if (!targetUser) {
        return res.status(400).json({
          success: false,
          message: 'userId or email is required to check MFA status.'
        });
      }

      const isMfaActive = await mfaService.isMfaActive(targetUser);
      return res.status(200).json({
        success: true,
        user: targetUser,
        mfaActive: isMfaActive
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify MFA status: ' + err.message
      });
    }
  }

  // POST /api/auth/mfa/enroll (Authenticated)
  async enrollMfa(req, res) {
    try {
      const user = req.user || req.admin;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to enroll in multi-factor authentication.'
        });
      }

      const identifier = user.email || user.userId || user.id || 'admin@puvima.com';
      const enrollment = mfaService.generateEnrollment(identifier);

      return res.status(200).json({
        success: true,
        message: 'MFA secret and backup recovery codes generated successfully.',
        secret: enrollment.secret,
        otpauthUrl: enrollment.otpauthUrl,
        recoveryCodes: enrollment.recoveryCodes,
        hashedRecoveryCodes: enrollment.hashedRecoveryCodes
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate MFA credentials: ' + err.message
      });
    }
  }

  // POST /api/auth/mfa/activate (Authenticated)
  async activateMfa(req, res) {
    try {
      const user = req.user || req.admin;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to activate multi-factor authentication.'
        });
      }

      const { secret, code, recoveryCodes } = req.body || {};
      if (!secret || !code) {
        return res.status(400).json({
          success: false,
          message: 'Both secret and initial 6-digit TOTP verification code are required.'
        });
      }

      const identifier = user.email || user.userId || user.id;

      // Hash raw recovery codes if array of plaintext codes provided
      let hashedCodes = [];
      if (Array.isArray(recoveryCodes) && recoveryCodes.length > 0) {
        hashedCodes = recoveryCodes.map(rc => 
          rc.length === 64 ? rc : crypto.createHash('sha256').update(String(rc).trim().toUpperCase()).digest('hex')
        );
      }

      const result = await mfaService.activateEnrollment(identifier, secret, code, hashedCodes);
      if (!result.success) {
        await auditService.logAuthFailure(req, identifier, 'Failed MFA initial activation verification');
        return res.status(400).json(result);
      }

      await auditService.logAdminAction(req, user, 'MFA_ACTIVATED', { userId: identifier });

      return res.status(200).json({
        success: true,
        message: 'Multi-factor authentication successfully activated.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to activate MFA: ' + err.message
      });
    }
  }

  // POST /api/auth/mfa/verify (Two-step login verification)
  async verifyMfa(req, res) {
    try {
      const { email, userId, code } = req.body || {};
      const targetUser = (userId || email || '').trim().toLowerCase();

      if (!targetUser || !code) {
        return res.status(400).json({
          success: false,
          message: 'User identifier and 6-digit code or recovery key are required.'
        });
      }

      const result = await mfaService.verifyUserLogin(targetUser, code);
      if (!result.success) {
        await auditService.logAuthFailure(req, targetUser, 'Invalid MFA verification code');
        return res.status(401).json({
          success: false,
          message: result.message || 'Invalid authentication code or recovery key.'
        });
      }

      // Generate fully authorized session token
      const token = signToken({
        email: targetUser,
        role: targetUser.includes('admin') ? 'admin' : 'hr',
        mfaVerified: true,
        name: 'PUVIMA Verified User'
      });

      const userObj = {
        email: targetUser,
        role: targetUser.includes('admin') ? 'admin' : 'hr',
        mfaVerified: true
      };

      await auditService.logAuthSuccess(req, userObj);

      return res.status(200).json({
        success: true,
        message: 'MFA verification successful.',
        token,
        method: result.method,
        remainingCodesCount: result.remainingCodesCount,
        user: userObj
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error verifying MFA: ' + err.message
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      let token = req.token;
      const authHeader = req.headers['authorization'];
      if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (!token && req.headers['x-admin-token']) {
        token = req.headers['x-admin-token'];
      }

      if (token) {
        revokeToken(token);
      }

      const user = req.user || req.admin || { role: 'anonymous' };
      await auditService.logLogout(req, user);

      return res.status(200).json({
        success: true,
        message: 'Session terminated and authorization token revoked successfully.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error processing logout: ' + err.message
      });
    }
  }
}

module.exports = new AuthController();

