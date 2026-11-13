/**
 * Puvima IT Service and Research Consultancy — Enterprise Security Audit Logging & Monitoring Service
 * Implements structured, immutable security event logging for authentication,
 * administrative actions, authorization failures, and sensitive asset access.
 * Strictly filters out passwords, tokens, cookies, and sensitive payloads.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');

const DATA_DIR = path.resolve(__dirname, '../../../data');
const BACKEND_DATA_DIR = path.resolve(__dirname, '../../data');
const LOG_FILE = path.join(DATA_DIR, 'security-audit-log.json');
const BACKEND_LOG_FILE = path.join(BACKEND_DATA_DIR, 'security-audit-log.json');

const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|cookie|session|privatekey|credential/i;

function ensureAuditFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKEND_DATA_DIR)) fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });

    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, JSON.stringify({ auditLogs: [] }, null, 2), 'utf8');
    }
    if (!fs.existsSync(BACKEND_LOG_FILE)) {
      fs.writeFileSync(BACKEND_LOG_FILE, JSON.stringify({ auditLogs: [] }, null, 2), 'utf8');
    }
  } catch (err) {
    // Graceful in read-only serverless hosts
  }
}

/**
 * Recursively redacts sensitive keys from audit log metadata
 */
function sanitizeDetails(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDetails);

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeDetails(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

class SecurityAuditService {
  constructor() {
    ensureAuditFiles();
  }

  readLocalLogs() {
    try {
      const file = fs.existsSync(LOG_FILE) ? LOG_FILE : (fs.existsSync(BACKEND_LOG_FILE) ? BACKEND_LOG_FILE : null);
      if (file) {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed.auditLogs || []);
      }
    } catch (e) {}
    return [];
  }

  writeLocalLogs(logs) {
    try {
      const capped = logs.slice(-2000); // Retain last 2000 security events
      const json = JSON.stringify({ auditLogs: capped }, null, 2);
      if (fs.existsSync(DATA_DIR)) fs.writeFileSync(LOG_FILE, json, 'utf8');
      if (fs.existsSync(BACKEND_DATA_DIR)) fs.writeFileSync(BACKEND_LOG_FILE, json, 'utf8');
    } catch (e) {}
  }

  /**
   * Generic logging method supporting { req, action, category, severity, user, details }
   */
  async log(entry = {}) {
    if (entry.req) {
      return this.recordEvent({
        eventType: entry.category || 'SECURITY_EVENT',
        action: entry.action || 'ACTION',
        actorId: entry.user?.email || entry.user?.userId || entry.user?.id || 'anonymous',
        actorRole: entry.user?.role || 'Public',
        targetResource: entry.req.originalUrl || entry.path || 'system',
        outcome: (entry.severity === 'ERROR' || entry.severity === 'CRITICAL') ? 'FAILURE' : 'SUCCESS',
        ip: entry.req.ip || entry.req.headers?.['x-forwarded-for'] || '127.0.0.1',
        userAgent: entry.req.headers?.['user-agent'],
        details: entry.details || {}
      });
    }
    return this.recordEvent(entry);
  }

  /**
   * Records a security event
   * @param {Object} entry 
   * @returns {Promise<Object>} The recorded audit record
   */
  async recordEvent(entry = {}) {
    const correlationId = entry.correlationId || crypto.randomBytes(8).toString('hex');
    const record = {
      id: crypto.randomUUID(),
      correlationId,
      timestamp: new Date().toISOString(),
      eventType: entry.eventType || 'SECURITY_EVENT',
      action: entry.action || 'UNKNOWN_ACTION',
      actorId: entry.actorId || 'anonymous',
      actorRole: entry.actorRole || 'Public',
      targetResource: entry.targetResource || 'system',
      outcome: entry.outcome || 'SUCCESS', // SUCCESS, FAILURE, DENIED, BLOCKED, ERROR
      ip: entry.ip || '0.0.0.0',
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 200) : null,
      details: sanitizeDetails(entry.details || {})
    };

    // 1. Try MySQL insertion if schema table exists
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const sql = `
          INSERT INTO security_audit_logs 
          (event_type, action, actor_id, actor_role, target_resource, outcome, ip_address, details, correlation_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const detailsJson = JSON.stringify(record.details);
        await db.query(sql, [
          record.eventType,
          record.action,
          record.actorId,
          record.actorRole,
          record.targetResource,
          record.outcome,
          record.ip,
          detailsJson,
          record.correlationId
        ]);
      }
    } catch (err) {
      // Table may not exist yet; gracefully fallback to local file
    }

    // 2. Mirror into JSON log
    const local = this.readLocalLogs();
    local.push(record);
    this.writeLocalLogs(local);

    // 3. Console security alert if outcome is DENIED, BLOCKED, or FAILURE
    if (record.outcome === 'DENIED' || record.outcome === 'BLOCKED') {
      console.warn(`[SECURITY AUDIT - ${record.outcome}] ${record.eventType}: ${record.action} by ${record.actorId} (${record.actorRole}) from IP ${record.ip}`);
    }

    return record;
  }

  // Convenience methods
  async logAuthSuccess(arg1, arg2) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const user = arg2 || {};
      return this.recordEvent({
        eventType: 'AUTH_SUCCESS',
        action: 'LOGIN',
        actorId: user.email || user.userId || 'admin',
        actorRole: user.role || 'admin',
        targetResource: req.originalUrl || '/api/admin/login',
        outcome: 'SUCCESS',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent'],
        details: { authMethod: 'password' }
      });
    }

    const { actorId, actorRole, ip, userAgent, method = 'password' } = arg1 || {};
    return this.recordEvent({
      eventType: 'AUTH_SUCCESS',
      action: 'LOGIN',
      actorId,
      actorRole,
      targetResource: '/api/auth/login',
      outcome: 'SUCCESS',
      ip,
      userAgent,
      details: { authMethod: method }
    });
  }

  async logAuthFailure(arg1, arg2, arg3) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const attemptedEmail = arg2 || 'unknown';
      const reason = arg3 || 'Invalid credentials';
      return this.recordEvent({
        eventType: 'AUTH_FAILURE',
        action: 'LOGIN',
        actorId: attemptedEmail,
        actorRole: 'Unauthenticated',
        targetResource: req.originalUrl || '/api/admin/login',
        outcome: 'FAILURE',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent'],
        details: { reason, attemptedEmail }
      });
    }

    const { actorId, actorRole, ip, userAgent, reason, attemptedEmail } = arg1 || {};
    return this.recordEvent({
      eventType: 'AUTH_FAILURE',
      action: 'LOGIN',
      actorId: actorId || attemptedEmail || 'unknown',
      actorRole: actorRole || 'Unauthenticated',
      targetResource: '/api/auth/login',
      outcome: 'FAILURE',
      ip,
      userAgent,
      details: { reason, attemptedEmail }
    });
  }

  async logLogout(arg1, arg2) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const user = arg2 || {};
      return this.recordEvent({
        eventType: 'AUTH_LOGOUT',
        action: 'LOGOUT',
        actorId: user.email || user.userId || 'unknown',
        actorRole: user.role || 'User',
        targetResource: req.originalUrl || '/api/admin/logout',
        outcome: 'SUCCESS',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent']
      });
    }

    const { actorId, actorRole, ip } = arg1 || {};
    return this.recordEvent({
      eventType: 'AUTH_LOGOUT',
      action: 'LOGOUT',
      actorId,
      actorRole,
      targetResource: '/api/auth/logout',
      outcome: 'SUCCESS',
      ip
    });
  }

  async logAccessDenied(arg1, arg2, arg3) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const user = arg2 || {};
      const requiredRole = arg3;
      return this.recordEvent({
        eventType: 'AUTHORIZATION_DENIED',
        action: 'ACCESS_ATTEMPT',
        actorId: user.email || user.userId || 'anonymous',
        actorRole: user.role || 'Public',
        targetResource: req.originalUrl,
        outcome: 'DENIED',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent'],
        details: { requiredRole }
      });
    }

    const { actorId, actorRole, resource, requiredRole, ip } = arg1 || {};
    return this.recordEvent({
      eventType: 'AUTHORIZATION_DENIED',
      action: 'ACCESS_ATTEMPT',
      actorId,
      actorRole,
      targetResource: resource,
      outcome: 'DENIED',
      ip,
      details: { requiredRole }
    });
  }

  async logRateLimitExceeded({ ip, endpoint, windowMs }) {
    return this.recordEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      action: 'RATE_LIMIT_TRIGGERED',
      actorId: 'anonymous',
      actorRole: 'Public',
      targetResource: endpoint,
      outcome: 'BLOCKED',
      ip,
      details: { windowMs }
    });
  }

  async logAdminAction(arg1, arg2, arg3, arg4) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const user = arg2 || {};
      const action = arg3 || 'ADMIN_ACTION';
      const details = arg4 || {};
      return this.recordEvent({
        eventType: 'ADMIN_ACTION',
        action,
        actorId: user.email || user.userId || 'admin',
        actorRole: user.role || 'admin',
        targetResource: req.originalUrl,
        outcome: 'SUCCESS',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent'],
        details
      });
    }

    const { action, actorId, actorRole, targetResource, details, ip } = arg1 || {};
    return this.recordEvent({
      eventType: 'ADMIN_ACTION',
      action,
      actorId,
      actorRole,
      targetResource,
      outcome: 'SUCCESS',
      ip,
      details
    });
  }

  async logResumeAccess(arg1, arg2, arg3) {
    if (arg1 && arg1.headers) {
      const req = arg1;
      const applicationId = arg2;
      const user = arg3 || {};
      return this.recordEvent({
        eventType: 'RESUME_ACCESS',
        action: 'VIEW_RESUME',
        actorId: user.email || user.userId || user.name || 'admin',
        actorRole: user.role || 'admin',
        targetResource: req.originalUrl || `resume:${applicationId}`,
        outcome: 'SUCCESS',
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.headers['user-agent'],
        details: { applicationId }
      });
    }

    const { actorId, actorRole, applicationId, referenceId, candidateName, ip } = arg1 || {};
    return this.recordEvent({
      eventType: 'RESUME_ACCESS',
      action: 'VIEW_RESUME',
      actorId,
      actorRole,
      targetResource: `resume:${applicationId}`,
      outcome: 'SUCCESS',
      ip,
      details: { referenceId, candidateName }
    });
  }

  /**
   * Retrieves audit logs with filtering and pagination.
   */
  async getAuditLogs({ eventType, actorRole, outcome, limit = 100, offset = 0 } = {}) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = 'SELECT * FROM security_audit_logs WHERE 1=1';
        const params = [];
        if (eventType && eventType !== 'all') {
          sql += ' AND event_type = ?';
          params.push(eventType);
        }
        if (actorRole && actorRole !== 'all') {
          sql += ' AND actor_role = ?';
          params.push(actorRole);
        }
        if (outcome && outcome !== 'all') {
          sql += ' AND outcome = ?';
          params.push(outcome);
        }
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const rows = await db.query(sql, params);
        if (Array.isArray(rows) && rows.length > 0) {
          return {
            total: rows.length,
            logs: rows.map(r => ({
              ...r,
              details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
            }))
          };
        }
      }
    } catch (e) {}

    // 2. Fallback to local JSON
    let logs = this.readLocalLogs();
    if (eventType && eventType !== 'all') logs = logs.filter(l => l.eventType === eventType);
    if (actorRole && actorRole !== 'all') logs = logs.filter(l => l.actorRole === actorRole);
    if (outcome && outcome !== 'all') logs = logs.filter(l => l.outcome === outcome);

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = logs.length;
    const paginated = logs.slice(offset, offset + limit);

    return { total, logs: paginated };
  }

  async getRecentLogs(filter = {}) {
    const res = await this.getAuditLogs({
      eventType: filter.category,
      limit: filter.limit || 50
    });
    let list = res.logs || [];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(l => 
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.actorId && l.actorId.toLowerCase().includes(q)) ||
        (l.eventType && l.eventType.toLowerCase().includes(q))
      );
    }
    return list;
  }
}

module.exports = new SecurityAuditService();
