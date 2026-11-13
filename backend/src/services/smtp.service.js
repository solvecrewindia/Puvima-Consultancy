/**
 * Puvima IT Service and Research Consultancy — Enterprise SMTP Email Dispatch Service
 * Powered by Nodemailer.
 * Supports multi-account dynamic login (Gmail, PUVIMA, Custom SMTP).
 */

const nodemailer = require('nodemailer');
const imapService = require('./imap.service');
const { resolveHostSafely } = require('../utils/dnsResolver');

function getSenderDisplayName(email) {
  if (!email) return 'PUVIMA';
  const clean = String(email).trim().toLowerCase();
  if (clean.includes('admin@puvima.com')) {
    return 'Principal Consultant';
  }
  if (clean.includes('contact@puvima.com')) {
    return 'PUVIMA';
  }
  return process.env.MAIL_FROM_NAME || 'PUVIMA';
}

class SmtpService {
  constructor() {
    this.transporters = new Map();
  }

  getEnvConfig() {
    const host = process.env.SMTP_HOST || null;
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER || null;
    const pass = process.env.SMTP_PASS || null;
    const fromName = getSenderDisplayName(user);
    const rawFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || user || 'contact@puvima.com';
    const from = rawFrom.includes('<') ? rawFrom : `"${fromName}" <${rawFrom}>`;
    const isExplicitSecure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true;
    const secure = isExplicitSecure || port === 465;

    if (host && user && pass) {
      return { host, port, secure, auth: { user, pass }, from };
    }
    return null;
  }

  resolveConfig(customConfig) {
    if (customConfig && customConfig.user && customConfig.pass && customConfig.host) {
      const port = parseInt(customConfig.port, 10) || 465;
      const isExplicitSecure = customConfig.secure !== undefined ? Boolean(customConfig.secure) : port === 465;
      const userEmail = customConfig.user || 'admin@puvima.com';
      const fromName = customConfig.name || getSenderDisplayName(userEmail);
      const rawFrom = customConfig.from || userEmail;
      const from = rawFrom.includes('<') ? rawFrom : `"${fromName}" <${rawFrom}>`;
      return {
        host: customConfig.host,
        port,
        secure: isExplicitSecure,
        auth: {
          user: customConfig.user,
          pass: customConfig.pass
        },
        from
      };
    }
    return this.getEnvConfig();
  }

  isConfigured(customConfig) {
    return Boolean(this.resolveConfig(customConfig));
  }

  async getTransporter(customConfig) {
    const cfg = this.resolveConfig(customConfig);
    if (!cfg) {
      throw new Error('SMTP is not configured. Please connect your mailbox in the application.');
    }

    const key = cfg.auth.user.toLowerCase();
    if (this.transporters.has(key)) {
      return this.transporters.get(key);
    }

    const resolvedHost = await resolveHostSafely(cfg.host);

    const transporter = nodemailer.createTransport({
      host: resolvedHost,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: !cfg.secure && cfg.port === 587,
      auth: cfg.auth,
      tls: {
        servername: cfg.host,
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });

    this.transporters.set(key, transporter);
    return transporter;
  }

  async testConnection(customConfig) {
    const cfg = this.resolveConfig(customConfig);
    if (!cfg) {
      return {
        configured: false,
        connected: false,
        message: 'No SMTP credentials provided'
      };
    }
    try {
      const transporter = await this.getTransporter(customConfig);
      await transporter.verify();
      return {
        configured: true,
        connected: true,
        message: 'SMTP transport verified successfully'
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        message: err.message
      };
    }
  }

  async sendMail({ to, cc, bcc, subject, text, html, inReplyTo, references, attachments = [] }, customConfig = null) {
    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error('At least one recipient (To) is required.');
    }

    const cfg = this.resolveConfig(customConfig);
    const transporter = await this.getTransporter(customConfig);

    const formatRecipients = (val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map(r => r.trim()).filter(Boolean).join(', ');
      return String(val).trim();
    };

    const mailOptions = {
      from: cfg.from,
      to: formatRecipients(to),
      cc: formatRecipients(cc),
      bcc: formatRecipients(bcc),
      subject: subject || '(No Subject)',
      text: text || '',
      html: html || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename || att.originalname || 'attachment',
        content: att.buffer || att.content,
        contentType: att.mimetype || att.contentType || 'application/octet-stream'
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    try {
      if (imapService.isConfigured(customConfig) && info.messageId) {
        const rawDate = new Date().toUTCString();
        const rawMessage = [
          `From: ${cfg.from}`,
          `To: ${mailOptions.to}`,
          mailOptions.cc ? `Cc: ${mailOptions.cc}` : null,
          `Subject: ${mailOptions.subject}`,
          `Date: ${rawDate}`,
          `Message-ID: ${info.messageId}`,
          mailOptions.inReplyTo ? `In-Reply-To: ${mailOptions.inReplyTo}` : null,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          mailOptions.html || mailOptions.text || ''
        ].filter(Boolean).join('\r\n');

        imapService.appendSentMessage('Sent', rawMessage, customConfig).catch(() => {});
      }
    } catch (e) {}

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response
    };
  }
}

module.exports = new SmtpService();
