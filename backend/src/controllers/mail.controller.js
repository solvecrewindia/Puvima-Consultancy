/**
 * PUVIMA Consultancy — Mail Controller
 * Supports multi-account dynamic login (Gmail, PUVIMA, Custom IMAP/SMTP),
 * credentials testing, message retrieval, and outbound dispatch.
 */

const imapService = require('../services/imap.service');
const smtpService = require('../services/smtp.service');
const { signToken } = require('../utils/token');
const { validateOutboundHost } = require('../utils/ssrfGuard');

// In-memory session store: sessionToken -> mailboxCredentials
const connectedMailboxes = new Map();

function sanitizeHost(h) {
  if (!h) return h;
  return String(h).trim().replace(/securecerver\.net/gi, 'secureserver.net');
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
          message: 'Please provide both your GoDaddy email address and password.'
        });
      }

      // Default directly to GoDaddy SecureServer settings
      const defaultImap = 'imap.secureserver.net';
      const defaultSmtp = 'smtpout.secureserver.net';

      const imapCfg = {
        host: sanitizeHost(imapHost) || defaultImap,
        port: parseInt(imapPort, 10) || 993,
        secure: imapSecure !== undefined ? Boolean(imapSecure) : true,
        user: cleanEmail,
        pass
      };

      const displayName = cleanEmail.includes('admin@puvima.com')
        ? 'Principal Consultant'
        : (cleanEmail.includes('contact@puvima.com') ? 'PUVIMA' : 'PUVIMA');

      const smtpCfg = {
        host: sanitizeHost(smtpHost) || defaultSmtp,
        port: parseInt(smtpPort, 10) || 465,
        secure: smtpSecure !== undefined ? Boolean(smtpSecure) : true,
        user: cleanEmail,
        pass,
        name: displayName,
        from: `"${displayName}" <${cleanEmail}>`
      };

      // SSRF validation: Disallow loopback, private, or cloud metadata hosts
      const imapVal = await validateOutboundHost(imapCfg.host);
      if (!imapVal.valid) {
        return res.status(400).json({ success: false, message: 'Prohibited IMAP host: ' + imapVal.reason });
      }
      const smtpVal = await validateOutboundHost(smtpCfg.host);
      if (!smtpVal.valid) {
        return res.status(400).json({ success: false, message: 'Prohibited SMTP host: ' + smtpVal.reason });
      }

      // Test IMAP connectivity
      const imapTest = await imapService.testConnection(imapCfg);
      if (!imapTest.connected) {
        const errDetail = imapTest.message || '';
        let userMessage = `Unable to connect to GoDaddy IMAP (${imapCfg.host}:993): ${errDetail}`;
        if (/command failed/i.test(errDetail) || /authentication/i.test(errDetail) || /login/i.test(errDetail)) {
          userMessage = `Authentication failed: The password for "${cleanEmail}" was rejected by GoDaddy mail. Please verify your GoDaddy email password and try again.`;
        }
        return res.status(400).json({
          success: false,
          message: userMessage,
          details: imapTest.message
        });
      }

      // Test SMTP connectivity (Port 465 SSL, fallback to Port 587 if needed)
      let smtpTest = await smtpService.testConnection(smtpCfg);
      if (!smtpTest.connected) {
        // Attempt port 587 with STARTTLS as fallback
        const smtpCfg587 = { ...smtpCfg, port: 587, secure: false };
        const smtpTest587 = await smtpService.testConnection(smtpCfg587);
        if (smtpTest587.connected) {
          smtpCfg.port = 587;
          smtpCfg.secure = false;
        } else {
          return res.status(400).json({
            success: false,
            message: `SMTP verification failed: ${smtpTest.message}. Please check your GoDaddy email credentials.`,
            details: smtpTest.message
          });
        }
      }

      // Generate a signed session token for this authenticated mailbox session
      const mailToken = signToken({ email: cleanEmail, role: 'mail_user' });
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
        from: `"${displayName}" <${cleanEmail}>`
      };

      connectedMailboxes.set(mailToken, mailboxData);

      // Also support existing auth token if provided
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        connectedMailboxes.set(token, mailboxData);
      }

      return res.json({
        success: true,
        message: 'GoDaddy mailbox connected successfully.',
        token: mailToken,
        account: {
          email: cleanEmail,
          provider: 'godaddy',
          imapHost: imapCfg.host,
          smtpHost: smtpCfg.host
        }
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
      const imapCfg = imapService.isConfigured(creds);
      const smtpCfg = smtpService.isConfigured(creds);

      const accountEmail = (creds && creds.user) || process.env.IMAP_USER || process.env.SMTP_USER || 'sail.srmofficial@gmail.com';

      let imapStatus = { configured: imapCfg, connected: false };
      let smtpStatus = { configured: smtpCfg, connected: false };

      if (imapCfg) {
        try {
          const test = await imapService.testConnection(creds);
          imapStatus.connected = test.connected;
          if (test.message) imapStatus.message = test.message;
        } catch (e) {
          imapStatus.connected = false;
          imapStatus.message = e.message;
        }
      }

      if (smtpCfg) {
        try {
          const test = await smtpService.testConnection(creds);
          smtpStatus.connected = test.connected;
          if (test.message) smtpStatus.message = test.message;
        } catch (e) {
          smtpStatus.connected = false;
          smtpStatus.message = e.message;
        }
      }

      return res.json({
        success: true,
        account: {
          email: accountEmail,
          name: 'PUVIMA Mail',
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
      if (!imapService.isConfigured(creds)) {
        return res.json({
          success: true,
          configured: false,
          folders: [
            { name: 'Inbox', path: 'INBOX', role: 'inbox', unreadCount: 0 },
            { name: 'Starred', path: 'Starred', role: 'starred', unreadCount: 0 },
            { name: 'Sent', path: 'Sent', role: 'sent', unreadCount: 0 },
            { name: 'Spam', path: 'Spam', role: 'spam', unreadCount: 0 },
            { name: 'Archive', path: 'Archive', role: 'archive', unreadCount: 0 },
            { name: 'Trash', path: 'Trash', role: 'trash', unreadCount: 0 },
            { name: 'Scheduled', path: 'Scheduled', role: 'scheduled', unreadCount: 0 },
            { name: 'Drafts', path: 'Drafts', role: 'drafts', unreadCount: 0 }
          ],
          message: 'No mailbox connected yet.'
        });
      }

      const folders = await imapService.listFolders(creds);
      return res.json({
        success: true,
        configured: true,
        folders
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
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const search = req.query.search || '';
      const filter = req.query.filter || 'all';

      if (!imapService.isConfigured(creds)) {
        return res.json({
          success: true,
          configured: false,
          messages: [],
          total: 0,
          page,
          limit,
          unreadCount: 8,
          message: 'No mailbox connected yet. Connect your Gmail or custom IMAP account.'
        });
      }

      const data = await imapService.getMessages(folder, { page, limit, search, filter }, creds);
      return res.json({
        success: true,
        configured: true,
        ...data
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages: ' + err.message
      });
    }
  }

  // GET /api/mail/messages/:uid
  async getMessage(req, res) {
    try {
      const creds = extractCredentials(req);
      if (!imapService.isConfigured(creds)) {
        return res.status(400).json({
          success: false,
          message: 'Mailbox is not connected.'
        });
      }

      const uid = req.params.uid;
      const folder = req.query.folder || 'INBOX';
      const markAsRead = req.query.markAsRead !== 'false';

      const message = await imapService.getMessage(folder, uid, markAsRead, creds);
      return res.json({
        success: true,
        message
      });
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

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Recipient email address (To) is required.'
        });
      }

      const attachments = (req.files || []).map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype
      }));

      const smtpCfg = creds ? {
        host: creds.smtpHost,
        port: creds.smtpPort,
        secure: creds.smtpSecure,
        user: creds.user,
        pass: creds.pass,
        name: creds.name,
        from: creds.from || creds.user
      } : null;

      const result = await smtpService.sendMail({
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        inReplyTo,
        references,
        attachments
      }, smtpCfg);

      return res.json({
        success: true,
        message: 'Email dispatched successfully.',
        messageId: result.messageId
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
    try {
      const creds = extractCredentials(req);
      const { to, cc, subject, text, html, inReplyTo, references } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Reply recipient (To) is required.'
        });
      }

      const replySubject = subject && subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject || ''}`;

      const attachments = (req.files || []).map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype
      }));

      const smtpCfg = creds ? {
        host: creds.smtpHost,
        port: creds.smtpPort,
        secure: creds.smtpSecure,
        user: creds.user,
        pass: creds.pass,
        name: creds.name,
        from: creds.from || creds.user
      } : null;

      const result = await smtpService.sendMail({
        to,
        cc,
        subject: replySubject,
        text,
        html,
        inReplyTo,
        references,
        attachments
      }, smtpCfg);

      return res.json({
        success: true,
        message: 'Reply dispatched successfully.',
        messageId: result.messageId
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send reply: ' + err.message
      });
    }
  }

  // POST /api/mail/forward
  async forwardMail(req, res) {
    try {
      const creds = extractCredentials(req);
      const { to, cc, subject, text, html } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Forward recipient (To) is required.'
        });
      }

      const forwardSubject = subject && subject.toLowerCase().startsWith('fwd:') ? subject : `Fwd: ${subject || ''}`;

      const attachments = (req.files || []).map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype
      }));

      const smtpCfg = creds ? {
        host: creds.smtpHost,
        port: creds.smtpPort,
        secure: creds.smtpSecure,
        user: creds.user,
        pass: creds.pass,
        name: creds.name,
        from: creds.from || creds.user
      } : null;

      const result = await smtpService.sendMail({
        to,
        cc,
        subject: forwardSubject,
        text,
        html,
        attachments
      }, smtpCfg);

      return res.json({
        success: true,
        message: 'Forward dispatched successfully.',
        messageId: result.messageId
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to forward email: ' + err.message
      });
    }
  }

  // PATCH /api/mail/messages/:uid/read
  async markRead(req, res) {
    try {
      const creds = extractCredentials(req);
      const uid = req.params.uid;
      const folder = req.body.folder || 'INBOX';
      const read = req.body.read !== false;

      const result = await imapService.markRead(folder, uid, read, creds);
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

      const result = await imapService.markStarred(folder, uid, starred, creds);
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

      const result = await imapService.moveToTrash(folder, uid, creds);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete message: ' + err.message
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
