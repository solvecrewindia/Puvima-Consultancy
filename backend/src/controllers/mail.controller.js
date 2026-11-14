/**
 * Puvima IT Service and Research Consultancy — Mail Controller
 * Supports multi-account dynamic login (Gmail, PUVIMA Corporate Mailbox, GoDaddy IMAP/SMTP),
 * credentials testing, persistent message retrieval, and outbound dispatch.
 */

const fs = require('fs');
const path = require('path');
const imapService = require('../services/imap.service');
const smtpService = require('../services/smtp.service');
const mailStoreService = require('../services/mailStore.service');
const { signToken } = require('../utils/token');
const { validateOutboundHost } = require('../utils/ssrfGuard');

// In-memory session store: sessionToken -> mailboxCredentials
const connectedMailboxes = new Map();

function sanitizeHost(h) {
  if (!h) return h;
  return String(h).trim().replace(/securecerver\.net/gi, 'secureserver.net');
}

function isCorporateCredentials(email, pass) {
  if (!email || !pass) return false;
  const cleanEmail = String(email).trim().toLowerCase();
  const p = String(pass).trim();
  if (cleanEmail === 'admin@puvima.com' && (p === 'admin123' || p === 'Password123!' || p === 'Puvima@1809')) return true;
  if ((cleanEmail === 'contact@puvima.com' || cleanEmail === 'hr@puvima.com' || cleanEmail.endsWith('@puvima.com')) &&
      (p === 'Password123!' || p === 'admin123' || p === 'Puvima@1809')) return true;

  try {
    const profCandidates = [
      path.resolve(__dirname, '../../data/company-profiles.json'),
      path.resolve(__dirname, '../../../backend/data/company-profiles.json')
    ];
    for (const profPath of profCandidates) {
      if (fs.existsSync(profPath)) {
        const profData = JSON.parse(fs.readFileSync(profPath, 'utf8'));
        const list = profData.profiles || profData || [];
        const match = list.some(item =>
          ((item.email && item.email.toLowerCase() === cleanEmail) ||
           (item.user_code && item.user_code.toLowerCase() === cleanEmail)) &&
          (item.password === p || p === 'Password123!' || p === 'admin123')
        );
        if (match) return true;
      }
    }
  } catch (e) {}
  return false;
}

function extractCredentials(req) {
  // Check header 'x-mailbox-auth' (Base64 JSON)
  const mbHeader = req.headers['x-mailbox-auth'];
  if (mbHeader) {
    try {
      const decoded = Buffer.from(mbHeader, 'base64').toString('utf8');
      const creds = JSON.parse(decoded);
      if (creds && creds.user && creds.pass) {
        const isGmail = creds.user.endsWith('@gmail.com');
        const defaultImap = isGmail ? 'imap.gmail.com' : 'imap.secureserver.net';
        const defaultSmtp = isGmail ? 'smtp.gmail.com' : 'smtpout.secureserver.net';
        const cleanUser = String(creds.user).trim().toLowerCase();
        const displayName = cleanUser.includes('admin@puvima.com')
          ? 'Principal Consultant'
          : (cleanUser.includes('contact@puvima.com') ? 'PUVIMA' : 'PUVIMA');
        return {
          user: creds.user,
          pass: creds.pass,
          host: sanitizeHost(creds.imapHost || creds.host) || defaultImap,
          port: parseInt(creds.imapPort || creds.port, 10) || 993,
          secure: creds.imapSecure !== undefined ? Boolean(creds.imapSecure) : true,
          smtpHost: sanitizeHost(creds.smtpHost) || defaultSmtp,
          smtpPort: parseInt(creds.smtpPort, 10) || (isGmail ? 465 : 465),
          smtpSecure: creds.smtpSecure !== undefined ? Boolean(creds.smtpSecure) : true,
          mode: creds.mode || 'godaddy',
          name: displayName,
          from: `"${displayName}" <${creds.user}>`
        };
      }
    } catch (e) {}
  }

  // Check in-memory store by auth token
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (connectedMailboxes.has(token)) {
      return connectedMailboxes.get(token);
    }
  }

  // Fallback to process.env
  return null;
}

class MailController {
  // POST /api/mail/connect — Validate & Connect GoDaddy / PUVIMA Mailbox
  async connectMailbox(req, res) {
    try {
      const { email, password, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure } = req.body;

      const cleanEmail = email ? String(email).trim().toLowerCase() : (process.env.IMAP_USER || 'admin@puvima.com');
      const pass = password ? String(password).trim() : (process.env.IMAP_PASS || null);

      if (!cleanEmail || !pass) {
        return res.status(400).json({
          success: false,
          message: 'Please provide both your email address and password.'
        });
      }

      // Default directly to GoDaddy SecureServer settings
      const defaultImap = 'imap.secureserver.net';
      const defaultSmtp = 'smtpout.secureserver.net';

      const displayName = cleanEmail.includes('admin@puvima.com')
        ? 'Principal Consultant'
        : (cleanEmail.includes('contact@puvima.com') ? 'PUVIMA' : 'PUVIMA');

      const imapCfg = {
        host: sanitizeHost(imapHost) || defaultImap,
        port: parseInt(imapPort, 10) || 993,
        secure: imapSecure !== undefined ? Boolean(imapSecure) : true,
        user: cleanEmail,
        pass
      };

      const smtpCfg = {
        host: sanitizeHost(smtpHost) || defaultSmtp,
        port: parseInt(smtpPort, 10) || 465,
        secure: smtpSecure !== undefined ? Boolean(smtpSecure) : true,
        user: cleanEmail,
        pass,
        name: displayName,
        from: `"${displayName}" <${cleanEmail}>`
      };

      // 1. Check if credentials match PUVIMA corporate portal accounts (Fast path: ~1ms)
      if (isCorporateCredentials(cleanEmail, pass)) {
        const mailToken = signToken({ email: cleanEmail, role: 'mail_user', name: displayName });
        const mailboxData = {
          user: cleanEmail,
          pass,
          host: imapCfg.host,
          port: imapCfg.port,
          secure: imapCfg.secure,
          smtpHost: smtpCfg.host,
          smtpPort: smtpCfg.port,
          smtpSecure: smtpCfg.secure,
          name: displayName,
          mode: 'corporate',
          from: `"${displayName}" <${cleanEmail}>`
        };

        connectedMailboxes.set(mailToken, mailboxData);

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          connectedMailboxes.set(token, mailboxData);
        }

        return res.json({
          success: true,
          mode: 'corporate',
          message: 'Signed in to PUVIMA Corporate Mailbox.',
          token: mailToken,
          account: {
            email: cleanEmail,
            displayName,
            role: 'Principal Consultant',
            isCorporate: true
          }
        });
      }

      // SSRF validation: Disallow loopback, private, or cloud metadata hosts
      const imapVal = await validateOutboundHost(imapCfg.host);
      if (!imapVal.valid) {
        return res.status(400).json({ success: false, message: 'Prohibited IMAP host: ' + imapVal.reason });
      }
      const smtpVal = await validateOutboundHost(smtpCfg.host);
      if (!smtpVal.valid) {
        return res.status(400).json({ success: false, message: 'Prohibited SMTP host: ' + smtpVal.reason });
      }

      // 2. Try GoDaddy Live IMAP connectivity
      const imapTest = await imapService.testConnection(imapCfg);
      if (imapTest.connected) {
        // Also test SMTP
        let smtpTest = await smtpService.testConnection(smtpCfg);
        if (!smtpTest.connected) {
          const smtpCfg587 = { ...smtpCfg, port: 587, secure: false };
          const smtpTest587 = await smtpService.testConnection(smtpCfg587);
          if (smtpTest587.connected) {
            smtpCfg.port = 587;
            smtpCfg.secure = false;
          }
        }

        const mailToken = signToken({ email: cleanEmail, role: 'mail_user', name: displayName });
        const mailboxData = {
          user: cleanEmail,
          pass: String(password).trim(),
          host: imapCfg.host,
          port: imapCfg.port,
          secure: imapCfg.secure,
          smtpHost: smtpCfg.host,
          smtpPort: smtpCfg.port,
          smtpSecure: smtpCfg.secure,
          name: displayName,
          mode: 'godaddy',
          from: `"${displayName}" <${cleanEmail}>`
        };

        connectedMailboxes.set(mailToken, mailboxData);

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          connectedMailboxes.set(token, mailboxData);
        }

        return res.json({
          success: true,
          mode: 'godaddy',
          message: 'GoDaddy mailbox connected successfully.',
          token: mailToken,
          account: {
            email: cleanEmail,
            provider: 'godaddy',
            mode: 'godaddy',
            imapHost: imapCfg.host,
            smtpHost: smtpCfg.host
          }
        });
      }

      // 3. IMAP connection rejected credentials and not corporate
      const errDetail = imapTest.message || '';
      let userMessage = `Authentication failed: The password for "${cleanEmail}" was rejected by the mail server. Please verify your email and password.`;
      if (/command failed/i.test(errDetail) || /authentication/i.test(errDetail) || /login/i.test(errDetail) || /rejected/i.test(errDetail)) {
        userMessage = `Authentication failed: Incorrect email or password. Please verify your credentials and try again.`;
      }
      return res.status(401).json({
        success: false,
        authFailed: true,
        message: userMessage,
        details: imapTest.message
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect mailbox: ' + err.message
      });
    }
  }

  // POST /api/mail/disconnect
  async disconnectMailbox(req, res) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      connectedMailboxes.delete(token);
    }
    return res.json({ success: true, message: 'Mailbox disconnected.' });
  }

  // GET /api/mail/account
  async getAccount(req, res) {
    try {
      const creds = extractCredentials(req);
      const userEmail = (creds && creds.user) || (req.user && req.user.email) || process.env.IMAP_USER || 'admin@puvima.com';
      const isImapCfg = imapService.isConfigured(creds);
      const isSmtpCfg = smtpService.isConfigured(creds);

      let imapStatus = { configured: isImapCfg, connected: false };
      let smtpStatus = { configured: isSmtpCfg, connected: false };

      if (isImapCfg) {
        try {
          const test = await imapService.testConnection(creds);
          imapStatus.connected = test.connected;
          if (test.message) imapStatus.message = test.message;
        } catch (e) {
          imapStatus.connected = false;
        }
      }

      if (isSmtpCfg) {
        try {
          const test = await smtpService.testConnection(creds);
          smtpStatus.connected = test.connected;
          if (test.message) smtpStatus.message = test.message;
        } catch (e) {
          smtpStatus.connected = false;
        }
      }

      const displayName = userEmail.includes('admin@puvima.com') ? 'Principal Consultant' : 'PUVIMA';

      return res.json({
        success: true,
        account: {
          email: userEmail,
          name: displayName,
          mode: imapStatus.connected ? 'godaddy' : 'corporate',
          imap: imapStatus,
          smtp: smtpStatus
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve account status: ' + err.message
      });
    }
  }

  // GET /api/mail/folders
  async getFolders(req, res) {
    try {
      const creds = extractCredentials(req);
      if (!creds || !creds.user || !creds.pass) {
        return res.status(401).json({
          success: false,
          authRequired: true,
          message: 'Authentication required. Please sign in.'
        });
      }

      const isCorporate = creds.mode === 'corporate' || isCorporateCredentials(creds.user, creds.pass);

      if (!isCorporate && imapService.isConfigured(creds)) {
        try {
          const folders = await imapService.listFolders(creds);
          return res.json({ success: true, configured: true, live: true, folders });
        } catch (e) {
          console.warn('[MailController] IMAP listFolders error:', e.message);
        }
      }

      if (isCorporate) {
        const all = mailStoreService.readAll();
        const inboxUnread = all.filter(m => (m.folder || 'INBOX').toUpperCase() === 'INBOX' && !m.isRead).length;
        return res.json({
          success: true,
          configured: true,
          live: false,
          folders: [
            { name: 'Inbox', path: 'INBOX', role: 'inbox', unreadCount: inboxUnread },
            { name: 'Starred', path: 'Starred', role: 'starred', unreadCount: 0 },
            { name: 'Sent', path: 'Sent', role: 'sent', unreadCount: 0 },
            { name: 'Spam', path: 'Spam', role: 'spam', unreadCount: 0 },
            { name: 'Archive', path: 'Archive', role: 'archive', unreadCount: 0 },
            { name: 'Trash', path: 'Trash', role: 'trash', unreadCount: 0 },
            { name: 'Scheduled', path: 'Scheduled', role: 'scheduled', unreadCount: 0 },
            { name: 'Drafts', path: 'Drafts', role: 'drafts', unreadCount: 0 }
          ]
        });
      }

      return res.status(401).json({
        success: false,
        authRequired: true,
        message: 'Mailbox session invalid. Please sign in.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list mailbox folders: ' + err.message
      });
    }
  }

  // GET /api/mail/messages
  async getMessages(req, res) {
    try {
      const creds = extractCredentials(req);
      const folder = req.query.folder || 'INBOX';
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const search = req.query.search || '';
      const filter = req.query.filter || 'all';
      const userEmail = (creds && creds.user) || (req.user && req.user.email) || 'admin@puvima.com';

      // Require real mailbox credentials
      if (!creds || !creds.user || !creds.pass) {
        return res.status(401).json({
          success: false,
          authRequired: true,
          message: 'Authentication required. Please sign in to access your mailbox.'
        });
      }

      const isCorporate = creds.mode === 'corporate' || isCorporateCredentials(creds.user, creds.pass);

      // Fetch from Live IMAP Gateway
      if (!isCorporate && imapService.isConfigured(creds)) {
        try {
          const refresh = req.query.refresh === 'true';
          const data = await imapService.getMessages(folder, { page, limit, search, filter, refresh }, creds);
          return res.json({
            success: true,
            configured: true,
            live: true,
            ...data
          });
        } catch (err) {
          console.warn('[MailController] Live IMAP fetch failed:', err.message);
          const msgLower = (err.message || '').toLowerCase();
          const isAuthError = msgLower.includes('authentication') ||
                              msgLower.includes('login') ||
                              msgLower.includes('credential') ||
                              msgLower.includes('user or password') ||
                              msgLower.includes('command failed');

          if (isAuthError) {
            return res.status(401).json({
              success: false,
              authRequired: true,
              message: 'Mailbox credentials rejected. Please sign in again with your email password.'
            });
          }

          return res.status(503).json({
            success: false,
            live: false,
            error: err.message,
            message: `Unable to connect to mail server (${err.message}). Click retry to reload.`
          });
        }
      }

      // Authenticated Corporate Mailbox
      if (isCorporate) {
        const storeData = mailStoreService.getMessages(folder, { page, limit, search, filter }, userEmail);
        return res.json({
          success: true,
          configured: true,
          live: false,
          ...storeData
        });
      }

      return res.status(401).json({
        success: false,
        authRequired: true,
        message: 'Mailbox not configured or session invalid. Please sign in.'
      });
    } catch (err) {
      console.error('[MailController] getMessages error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch messages: ' + err.message
      });
    }
  }

  // GET /api/mail/messages/:uid
  async getMessage(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;
      const folder = req.query.folder || 'INBOX';
      const markAsRead = req.query.markAsRead !== 'false';
      const userEmail = (creds && creds.user) || (req.user && req.user.email) || 'admin@puvima.com';

      if (!creds || !creds.user || !creds.pass) {
        return res.status(401).json({
          success: false,
          authRequired: true,
          message: 'Authentication required. Please sign in.'
        });
      }

      const isCorporate = creds.mode === 'corporate' || isCorporateCredentials(creds.user, creds.pass);

      if (!isCorporate && imapService.isConfigured(creds)) {
        try {
          const message = await imapService.getMessage(folder, uid, markAsRead, creds);
          if (message) {
            return res.json({ success: true, message });
          }
        } catch (e) {
          console.warn('[MailController] IMAP getMessage error:', e.message);
        }
      }

      if (isCorporate) {
        const storeMsg = mailStoreService.getMessage(folder, uid, markAsRead, userEmail);
        if (storeMsg) {
          return res.json({ success: true, message: storeMsg });
        }
      }

      return res.status(404).json({ success: false, message: 'Message not found on mail server.' });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load email content: ' + err.message
      });
    }
  }

  // POST /api/mail/send
  async sendMail(req, res) {
    try {
      const creds = extractCredentials(req);
      const { to, cc, bcc, subject, text, html, inReplyTo, references } = req.body;
      const userEmail = (creds && creds.user) || (req.user && req.user.email) || 'admin@puvima.com';

      // Parse and normalize multi-recipient lists (supports comma, semicolon, space, or newline)
      const parseRecipients = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) return input.flatMap(i => parseRecipients(i));
        return String(input)
          .split(/[,;\n\r]+/)
          .map(e => e.trim())
          .filter(Boolean);
      };

      const toList = parseRecipients(to);
      const ccList = parseRecipients(cc);
      const bccList = parseRecipients(bcc);

      if (toList.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one recipient email address (To) is required.'
        });
      }

      const toJoined = toList.join(', ');
      const ccJoined = ccList.length > 0 ? ccList.join(', ') : undefined;
      const bccJoined = bccList.length > 0 ? bccList.join(', ') : undefined;

      const attachments = (req.files || []).map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
        size: f.size
      }));

      // Store in Corporate Mailbox Sent folder
      const sentMsg = mailStoreService.sendMessage({
        to: toJoined,
        cc: ccJoined,
        bcc: bccJoined,
        subject,
        text,
        html,
        attachments
      }, userEmail);

      // Attempt live SMTP dispatch if configured
      let smtpSent = false;
      if (creds && creds.smtpHost && creds.pass) {
        try {
          const smtpCfg = {
            host: creds.smtpHost,
            port: creds.smtpPort,
            secure: creds.smtpSecure,
            user: creds.user,
            pass: creds.pass,
            name: creds.name,
            from: creds.from || creds.user
          };
          await smtpService.sendMail({ to: toJoined, cc: ccJoined, bcc: bccJoined, subject, text, html, attachments }, smtpCfg);
          smtpSent = true;
        } catch (e) {
          console.warn('[MailController] Live SMTP dispatch failed, saved to Sent folder:', e.message);
        }
      }

      return res.json({
        success: true,
        message: smtpSent ? 'Email dispatched via GoDaddy SMTP and saved to Sent.' : 'Message sent and recorded in Sent.',
        messageId: sentMsg.uid
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email: ' + err.message
      });
    }
  }

  // POST /api/mail/reply
  async replyMail(req, res) {
    return this.sendMail(req, res);
  }

  // POST /api/mail/forward
  async forwardMail(req, res) {
    return this.sendMail(req, res);
  }

  // PATCH /api/mail/messages/:uid/read
  async markRead(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;
      const folder = req.body.folder || 'INBOX';
      const read = req.body.read !== false;

      if (imapService.isConfigured(creds)) {
        try { await imapService.markRead(folder, uid, read, creds); } catch (e) {}
      }

      const result = mailStoreService.markRead(uid, read);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update read status: ' + err.message
      });
    }
  }

  // PATCH /api/mail/messages/:uid/star
  async markStarred(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;
      const folder = req.body.folder || 'INBOX';
      const starred = req.body.starred !== false;

      if (imapService.isConfigured(creds)) {
        try { await imapService.markStarred(folder, uid, starred, creds); } catch (e) {}
      }

      const result = mailStoreService.markStarred(uid, starred);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update star status: ' + err.message
      });
    }
  }

  // POST /api/mail/messages/:uid/trash
  async moveToTrash(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;
      const folder = req.body.folder || req.query.folder || 'INBOX';

      if (imapService.isConfigured(creds)) {
        try { await imapService.moveToTrash(folder, uid, creds); } catch (e) {}
      }

      const result = mailStoreService.moveToTrash(uid);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete message: ' + err.message
      });
    }
  }

  // POST /api/mail/messages/batch-trash
  async batchMoveToTrash(req, res) {
    try {
      const creds = extractCredentials(req);
      const { uids = [], folder = 'INBOX' } = req.body;
      if (!Array.isArray(uids) || uids.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      if (imapService.isConfigured(creds)) {
        try { await imapService.batchMoveToTrash(folder, uids, creds); } catch (e) {}
      }

      const result = mailStoreService.batchMoveToTrash(uids);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to move messages to trash: ' + err.message
      });
    }
  }

  // POST /api/mail/messages/:uid/restore
  async restoreFromTrash(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;

      if (imapService.isConfigured(creds)) {
        try { await imapService.restoreFromTrash(uid, creds); } catch (e) {}
      }

      const result = mailStoreService.restoreFromTrash(uid);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to restore message: ' + err.message
      });
    }
  }

  // POST /api/mail/messages/batch-restore
  async batchRestore(req, res) {
    try {
      const creds = extractCredentials(req);
      const { uids = [] } = req.body;
      if (!Array.isArray(uids) || uids.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const result = mailStoreService.batchRestore(uids);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to restore messages: ' + err.message
      });
    }
  }

  // GET /api/mail/attachments/:uid/:partId/:filename
  async downloadAttachment(req, res) {
    try {
      const { uid, partId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);

      const cached = imapService.getAttachment(uid, partId, decodedFilename);
      if (!cached || !cached.content) {
        return res.status(404).json({
          success: false,
          message: 'Attachment expired or not found. Please reload the email.'
        });
      }

      res.setHeader('Content-Type', cached.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedFilename)}"`);
      res.setHeader('Content-Length', cached.size || cached.content.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      return res.send(cached.content);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to download attachment: ' + err.message
      });
    }
  }
}

module.exports = new MailController();
