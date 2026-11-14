/**
 * Puvima IT Service and Research Consultancy — Enterprise IMAP Email Service
 * Powered by imapflow and mailparser.
 * Supports multi-account dynamic login (Gmail, PUVIMA, Custom IMAP)
 * with connection pooling, message parsing, search, and flags.
 */

let ImapFlow = null;
let simpleParser = null;
let sanitizeHtml = null;

function loadDependencies() {
  if (!ImapFlow) {
    try {
      const imapflowMod = require('imapflow');
      ImapFlow = imapflowMod.ImapFlow || imapflowMod;
    } catch (e) {
      console.warn('[IMAP Service] imapflow load warning:', e.message);
    }
  }
  if (!simpleParser) {
    try {
      const mailparserMod = require('mailparser');
      simpleParser = mailparserMod.simpleParser || mailparserMod;
    } catch (e) {
      console.warn('[IMAP Service] mailparser load warning:', e.message);
    }
  }
  if (!sanitizeHtml) {
    try {
      sanitizeHtml = require('sanitize-html');
    } catch (e) {
      sanitizeHtml = (html) => html;
    }
  }
}

const { resolveHostSafely } = require('../utils/dnsResolver');

class ImapService {
  constructor() {
    this.clients = new Map(); // userEmail -> client
    this.cachedAttachments = new Map(); // uid_filename -> buffer
    this.messagesCache = new Map(); // cacheKey -> { data, expiresAt }
  }

  clearCacheForUser(userEmail) {
    if (!userEmail) {
      this.messagesCache.clear();
      return;
    }
    const prefix = String(userEmail).toLowerCase() + ':';
    for (const key of this.messagesCache.keys()) {
      if (key.startsWith(prefix)) {
        this.messagesCache.delete(key);
      }
    }
  }

  getEnvConfig() {
    const host = process.env.IMAP_HOST || null;
    const port = parseInt(process.env.IMAP_PORT, 10) || 993;
    const secure = process.env.IMAP_SECURE === 'true' || process.env.IMAP_SECURE === true || port === 993;
    const user = process.env.IMAP_USER || null;
    const pass = process.env.IMAP_PASS || null;

    if (host && user && pass) {
      return { host, port, secure, auth: { user, pass } };
    }
    return null;
  }

  resolveConfig(customConfig) {
    if (customConfig && customConfig.user && customConfig.pass && customConfig.host) {
      const port = parseInt(customConfig.port, 10) || 993;
      const secure = customConfig.secure !== undefined ? Boolean(customConfig.secure) : port === 993;
      return {
        host: customConfig.host,
        port,
        secure,
        auth: {
          user: customConfig.user,
          pass: customConfig.pass
        }
      };
    }
    return this.getEnvConfig();
  }

  isConfigured(customConfig) {
    return Boolean(this.resolveConfig(customConfig));
  }

  async getClient(customConfig) {
    const cfg = this.resolveConfig(customConfig);
    if (!cfg) {
      throw new Error('IMAP is not configured. Please connect your mailbox in the application.');
    }

    const clientKey = cfg.auth.user.toLowerCase();
    const existing = this.clients.get(clientKey);

    if (existing && existing.usable) {
      return existing;
    }

    // Resolve host safely to prevent Windows getaddrinfo EAI_AGAIN lookup issues
    const resolvedHost = await resolveHostSafely(cfg.host);

    loadDependencies();
    if (!ImapFlow) {
      throw new Error('IMAP client engine is unavailable in this runtime environment');
    }

    // Connect new client
    const client = new ImapFlow({
      host: resolvedHost,
      port: cfg.port,
      secure: cfg.secure,
      servername: cfg.host,
      auth: cfg.auth,
      logger: false,
      clientInfo: {
        name: 'PUVIMA Mail',
        version: '1.0.0'
      },
      tls: {
        servername: cfg.host,
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });

    client.on('error', (err) => {
      // Don't crash process
    });

    client.on('close', () => {
      if (this.clients.get(clientKey) === client) {
        this.clients.delete(clientKey);
      }
    });

    await client.connect();
    this.clients.set(clientKey, client);
    return client;
  }

  async testConnection(customConfig) {
    const cfg = this.resolveConfig(customConfig);
    if (!cfg) {
      return {
        configured: false,
        connected: false,
        message: 'No IMAP credentials provided'
      };
    }

    let testClient = null;
    try {
      loadDependencies();
      if (!ImapFlow) {
        return {
          configured: true,
          connected: false,
          message: 'IMAP client engine is unavailable in this runtime environment'
        };
      }
      const resolvedHost = await resolveHostSafely(cfg.host);
      testClient = new ImapFlow({
        host: resolvedHost,
        port: cfg.port,
        secure: cfg.secure,
        servername: cfg.host,
        auth: cfg.auth,
        logger: false,
        tls: {
          servername: cfg.host,
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout to mail server (5s)')), 5000)
      );
      await Promise.race([testClient.connect(), timeoutPromise]);
      try { await testClient.logout(); } catch (e) {}
      return {
        configured: true,
        connected: true,
        message: 'IMAP connection successful'
      };
    } catch (err) {
      if (testClient && testClient.usable) {
        try { await testClient.logout(); } catch (e) {}
      }
      return {
        configured: true,
        connected: false,
        message: err.message
      };
    }
  }

  async resolveFolderPath(client, folder = 'INBOX') {
    if (!folder || String(folder).toUpperCase() === 'INBOX') {
      return 'INBOX';
    }

    const folderLower = String(folder).toLowerCase().trim();
    if (folderLower === 'starred' || folderLower === 'scheduled') {
      return folder;
    }

    try {
      const mailboxes = await client.list();
      let match = null;

      if (folderLower === 'sent') {
        match = mailboxes.find(m => (m.flags && m.flags.has('\\Sent')) || m.specialUse === '\\Sent' || m.path.toLowerCase().endsWith('sent') || m.name.toLowerCase() === 'sent');
      } else if (folderLower === 'drafts' || folderLower === 'draft') {
        match = mailboxes.find(m => (m.flags && m.flags.has('\\Drafts')) || m.specialUse === '\\Drafts' || m.path.toLowerCase().endsWith('drafts') || m.name.toLowerCase() === 'drafts');
      } else if (folderLower === 'trash' || folderLower === 'bin') {
        match = mailboxes.find(m => (m.flags && m.flags.has('\\Trash')) || m.specialUse === '\\Trash' || m.path.toLowerCase().includes('trash') || m.path.toLowerCase().includes('bin'));
      } else if (folderLower === 'spam' || folderLower === 'junk') {
        match = mailboxes.find(m => (m.flags && m.flags.has('\\Junk')) || m.specialUse === '\\Junk' || m.path.toLowerCase().includes('spam') || m.path.toLowerCase().includes('junk'));
      } else if (folderLower === 'archive' || folderLower === 'archives') {
        match = mailboxes.find(m => (m.flags && m.flags.has('\\Archive')) || m.specialUse === '\\Archive' || m.path.toLowerCase().includes('archive'));
      }

      if (match) return match.path;

      const direct = mailboxes.find(m => m.name.toLowerCase() === folderLower || m.path.toLowerCase() === folderLower);
      if (direct) return direct.path;
    } catch (e) {}

    return folder;
  }

  async listFolders(customConfig) {
    const client = await this.getClient(customConfig);
    const mailboxes = await client.list();
    
    return mailboxes.map(mb => {
      let role = 'custom';
      const flags = mb.flags || new Set();
      const pathLower = mb.path.toLowerCase();

      if (flags.has('\\Inbox') || pathLower === 'inbox') role = 'inbox';
      else if (flags.has('\\Sent') || pathLower.includes('sent')) role = 'sent';
      else if (flags.has('\\Drafts') || pathLower.includes('draft')) role = 'drafts';
      else if (flags.has('\\Trash') || pathLower.includes('trash') || pathLower.includes('bin')) role = 'trash';
      else if (flags.has('\\Junk') || pathLower.includes('spam') || pathLower.includes('junk')) role = 'spam';
      else if (flags.has('\\Flagged') || pathLower.includes('starred')) role = 'starred';

      return {
        name: mb.name,
        path: mb.path,
        delimiter: mb.delimiter,
        role,
        specialUse: mb.specialUse || null,
        subscribed: mb.subscribed
      };
    });
  }

  async getMessages(folder = 'INBOX', options = {}, customConfig = null) {
    const { page = 1, limit = 25, search = '', filter = 'all' } = options;
    const requestedFolder = String(folder || 'INBOX').trim();

    // 1. Scheduled (Virtual folder, always clean empty)
    if (requestedFolder.toLowerCase() === 'scheduled') {
      return {
        messages: [],
        total: 0,
        page,
        limit,
        unreadCount: 0
      };
    }

    const cfg = this.resolveConfig(customConfig);
    const userKey = (cfg && cfg.auth && cfg.auth.user ? cfg.auth.user : 'default').toLowerCase();
    const cacheKey = `${userKey}:${requestedFolder}:${page}:${limit}:${search}:${filter}`;
    const isForceRefresh = options.refresh === true || options.refresh === 'true';

    // In-memory cache hit (Instant response)
    if (!isForceRefresh && this.messagesCache.has(cacheKey)) {
      const cached = this.messagesCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
      this.messagesCache.delete(cacheKey);
    }

    const client = await this.getClient(customConfig);

    // 2. Starred (Virtual folder: Search INBOX for flagged messages)
    if (requestedFolder.toLowerCase() === 'starred' || filter === 'starred') {
      let lock = null;
      try {
        lock = await client.getMailboxLock('INBOX');
        const uids = await client.search({ flagged: true }, { uid: true });
        uids.sort((a, b) => b - a);
        const total = uids.length;
        const startIndex = (page - 1) * limit;
        const pagedUids = uids.slice(startIndex, startIndex + limit);

        if (pagedUids.length === 0) {
          const res = {
            messages: [],
            total,
            page,
            limit,
            unreadCount: 0
          };
          this.messagesCache.set(cacheKey, { data: res, expiresAt: Date.now() + 60000 });
          return res;
        }

        const messages = [];
        for await (const msg of client.fetch(pagedUids, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          size: true
        }, { uid: true })) {
          const flags = msg.flags || new Set();
          const env = msg.envelope || {};
          const fromAddress = env.from && env.from[0] ? env.from[0] : null;
          const fromFormatted = fromAddress
            ? { name: fromAddress.name || fromAddress.address, address: fromAddress.address }
            : { name: 'Unknown Sender', address: '' };

          messages.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: env.subject || '(No Subject)',
            from: fromFormatted,
            to: (env.to || []).map(t => ({ name: t.name || t.address, address: t.address })),
            date: env.date ? new Date(env.date).toISOString() : (msg.internalDate ? new Date(msg.internalDate).toISOString() : new Date().toISOString()),
            size: msg.size || 0,
            isRead: flags.has('\\Seen'),
            isStarred: true,
            hasAttachments: false,
            messageId: env.messageId || ''
          });
        }

        messages.sort((a, b) => new Date(b.date) - new Date(a.date));
        const res = {
          messages,
          total,
          page,
          limit,
          unreadCount: 0
        };
        this.messagesCache.set(cacheKey, { data: res, expiresAt: Date.now() + 60000 });
        return res;
      } catch (err) {
        return { messages: [], total: 0, page, limit, unreadCount: 0 };
      } finally {
        if (lock) lock.release();
      }
    }

    // 3. Mailbox Folders (Inbox, Sent, Drafts, Trash, Spam, Archive)
    const targetFolder = await this.resolveFolderPath(client, requestedFolder);
    let lock = null;
    try {
      lock = await client.getMailboxLock(targetFolder);
    } catch (err) {
      return {
        messages: [],
        total: 0,
        page,
        limit,
        unreadCount: 0
      };
    }

    try {
      const totalInMailbox = client.mailbox.exists || 0;
      if (totalInMailbox === 0) {
        const res = {
          messages: [],
          total: 0,
          page,
          limit,
          unreadCount: 0
        };
        this.messagesCache.set(cacheKey, { data: res, expiresAt: Date.now() + 60000 });
        return res;
      }

      const messages = [];

      // FAST PATH: Sequence-range fetch for default views (Up to 10x faster than full-scan search)
      if (!search && filter !== 'unread') {
        const seqEnd = Math.max(1, totalInMailbox - (page - 1) * limit);
        const seqStart = Math.max(1, totalInMailbox - page * limit + 1);

        if (seqEnd >= seqStart) {
          const seqRange = `${seqStart}:${seqEnd}`;
          for await (const msg of client.fetch(seqRange, {
            uid: true,
            envelope: true,
            flags: true,
            internalDate: true,
            size: true
          })) {
            const flags = msg.flags || new Set();
            const env = msg.envelope || {};
            const fromAddress = env.from && env.from[0] ? env.from[0] : null;
            const fromFormatted = fromAddress
              ? { name: fromAddress.name || fromAddress.address, address: fromAddress.address }
              : { name: 'Unknown Sender', address: '' };

            messages.push({
              uid: msg.uid,
              seq: msg.seq,
              subject: env.subject || '(No Subject)',
              from: fromFormatted,
              to: (env.to || []).map(t => ({ name: t.name || t.address, address: t.address })),
              date: env.date ? new Date(env.date).toISOString() : (msg.internalDate ? new Date(msg.internalDate).toISOString() : new Date().toISOString()),
              size: msg.size || 0,
              isRead: flags.has('\\Seen'),
              isStarred: flags.has('\\Flagged'),
              hasAttachments: false,
              messageId: env.messageId || ''
            });
          }
        }
      } else {
        // Search or unread filter
        let uids = [];
        if (search && search.trim()) {
          const query = search.trim();
          uids = await client.search({
            or: [
              { from: query },
              { subject: query },
              { body: query }
            ]
          }, { uid: true });
        } else if (filter === 'unread') {
          uids = await client.search({ unseen: true }, { uid: true });
        }

        uids.sort((a, b) => b - a);
        const startIndex = (page - 1) * limit;
        const pagedUids = uids.slice(startIndex, startIndex + limit);

        if (pagedUids.length > 0) {
          for await (const msg of client.fetch(pagedUids, {
            uid: true,
            envelope: true,
            flags: true,
            internalDate: true,
            size: true
          }, { uid: true })) {
            const flags = msg.flags || new Set();
            const env = msg.envelope || {};
            const fromAddress = env.from && env.from[0] ? env.from[0] : null;
            const fromFormatted = fromAddress
              ? { name: fromAddress.name || fromAddress.address, address: fromAddress.address }
              : { name: 'Unknown Sender', address: '' };

            messages.push({
              uid: msg.uid,
              seq: msg.seq,
              subject: env.subject || '(No Subject)',
              from: fromFormatted,
              to: (env.to || []).map(t => ({ name: t.name || t.address, address: t.address })),
              date: env.date ? new Date(env.date).toISOString() : (msg.internalDate ? new Date(msg.internalDate).toISOString() : new Date().toISOString()),
              size: msg.size || 0,
              isRead: flags.has('\\Seen'),
              isStarred: flags.has('\\Flagged'),
              hasAttachments: false,
              messageId: env.messageId || ''
            });
          }
        }
      }

      messages.sort((a, b) => new Date(b.date) - new Date(a.date));

      const res = {
        messages,
        total: totalInMailbox,
        page,
        limit,
        unreadCount: client.mailbox.unseen || 0
      };
      this.messagesCache.set(cacheKey, { data: res, expiresAt: Date.now() + 60000 });
      return res;
    } finally {
      if (lock) lock.release();
    }
  }

  async getMessage(folder = 'INBOX', uid, markAsRead = true, customConfig = null) {
    const client = await this.getClient(customConfig);
    const targetFolder = (String(folder).toLowerCase() === 'starred')
      ? 'INBOX'
      : await this.resolveFolderPath(client, folder);

    let lock = await client.getMailboxLock(targetFolder);
    try {
      const numUid = parseInt(uid, 10);
      const downloadResult = await client.download(numUid, undefined, { uid: true });
      if (!downloadResult || !downloadResult.content) {
        throw new Error(`Email message with UID ${uid} could not be downloaded.`);
      }

      loadDependencies();
      let parsed = null;
      if (simpleParser) {
        parsed = await simpleParser(downloadResult.content);
      } else {
        parsed = { text: downloadResult.content.toString('utf8'), attachments: [] };
      }

      if (markAsRead) {
        await client.messageFlagsAdd(numUid, ['\\Seen'], { uid: true }).catch(() => {});
      }

      let safeHtml = '';
      if (parsed.html) {
        if (typeof sanitizeHtml === 'function' && sanitizeHtml.defaults) {
          safeHtml = sanitizeHtml(parsed.html, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'hr', 'font']),
            allowedAttributes: {
              ...sanitizeHtml.defaults.allowedAttributes,
              '*': ['style', 'class', 'align', 'color', 'dir', 'valign', 'width', 'height'],
              a: ['href', 'name', 'target', 'rel'],
              img: ['src', 'alt', 'title', 'width', 'height', 'style']
            },
            allowedSchemes: ['http', 'https', 'mailto', 'data', 'cid'],
            transformTags: sanitizeHtml.simpleTransform ? {
              a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
            } : {}
          });
        } else {
          safeHtml = parsed.html;
        }
      } else if (parsed.textAsHtml) {
        safeHtml = parsed.textAsHtml;
      } else if (parsed.text) {
        safeHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(parsed.text)}</pre>`;
      }

      const attachments = (parsed.attachments || []).map((att, idx) => {
        const filename = att.filename || `attachment_${idx + 1}`;
        const cacheKey = `${uid}_${idx}_${filename}`;
        
        this.cachedAttachments.set(cacheKey, {
          content: att.content,
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || (att.content ? att.content.length : 0),
          filename
        });

        if (this.cachedAttachments.size > 100) {
          const firstKey = this.cachedAttachments.keys().next().value;
          this.cachedAttachments.delete(firstKey);
        }

        return {
          id: idx,
          filename,
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || (att.content ? att.content.length : 0),
          contentId: att.cid || null,
          downloadUrl: `/api/mail/attachments/${uid}/${idx}/${encodeURIComponent(filename)}`
        };
      });

      return {
        uid: numUid,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from ? { name: parsed.from.text || parsed.from.value[0]?.name, address: parsed.from.value[0]?.address } : { name: 'Unknown', address: '' },
        to: parsed.to ? (parsed.to.value || []).map(t => ({ name: t.name || t.address, address: t.address })) : [],
        cc: parsed.cc ? (parsed.cc.value || []).map(t => ({ name: t.name || t.address, address: t.address })) : [],
        bcc: parsed.bcc ? (parsed.bcc.value || []).map(t => ({ name: t.name || t.address, address: t.address })) : [],
        replyTo: parsed.replyTo ? parsed.replyTo.value[0]?.address : null,
        date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
        messageId: parsed.messageId || '',
        inReplyTo: parsed.inReplyTo || '',
        references: parsed.references || '',
        text: parsed.text || '',
        html: safeHtml,
        attachments
      };
    } finally {
      lock.release();
    }
  }

  getAttachment(uid, partId, filename) {
    const cacheKey = `${uid}_${partId}_${filename}`;
    return this.cachedAttachments.get(cacheKey) || null;
  }

  async markRead(folder = 'INBOX', uid, isRead = true, customConfig = null) {
    const client = await this.getClient(customConfig);
    const targetFolder = (String(folder).toLowerCase() === 'starred')
      ? 'INBOX'
      : await this.resolveFolderPath(client, folder);
    let lock = await client.getMailboxLock(targetFolder);
    try {
      const numUid = parseInt(uid, 10);
      if (isRead) {
        await client.messageFlagsAdd(numUid, ['\\Seen'], { uid: true });
      } else {
        await client.messageFlagsRemove(numUid, ['\\Seen'], { uid: true });
      }
      this.clearCacheForUser(customConfig?.user || customConfig?.auth?.user);
      return { success: true, uid: numUid, isRead };
    } finally {
      lock.release();
    }
  }

  async markStarred(folder = 'INBOX', uid, isStarred = true, customConfig = null) {
    const client = await this.getClient(customConfig);
    const targetFolder = (String(folder).toLowerCase() === 'starred')
      ? 'INBOX'
      : await this.resolveFolderPath(client, folder);
    let lock = await client.getMailboxLock(targetFolder);
    try {
      const numUid = parseInt(uid, 10);
      if (isStarred) {
        await client.messageFlagsAdd(numUid, ['\\Flagged'], { uid: true });
      } else {
        await client.messageFlagsRemove(numUid, ['\\Flagged'], { uid: true });
      }
      this.clearCacheForUser(customConfig?.user || customConfig?.auth?.user);
      return { success: true, uid: numUid, isStarred };
    } finally {
      lock.release();
    }
  }

  async moveToTrash(folder = 'INBOX', uid, customConfig = null) {
    const client = await this.getClient(customConfig);
    const targetFolder = (String(folder).toLowerCase() === 'starred')
      ? 'INBOX'
      : await this.resolveFolderPath(client, folder);
    let lock = await client.getMailboxLock(targetFolder);
    try {
      const numUid = parseInt(uid, 10);
      const mailboxes = await client.list();
      let trashFolder = mailboxes.find(m => (m.flags && m.flags.has('\\Trash')) || m.path.toLowerCase().includes('trash') || m.path.toLowerCase().includes('bin'));
      const trashPath = trashFolder ? trashFolder.path : 'Trash';

      if (targetFolder.toLowerCase() === trashPath.toLowerCase()) {
        await client.messageDelete(numUid, { uid: true });
        return { success: true, deleted: true };
      } else {
        await client.messageMove(numUid, trashPath, { uid: true });
        return { success: true, movedTo: trashPath };
      }
    } finally {
      lock.release();
    }
  }

  async appendSentMessage(folder = 'Sent', rawRfc822, customConfig = null) {
    try {
      const client = await this.getClient(customConfig);
      const mailboxes = await client.list();
      let sentBox = mailboxes.find(m => (m.flags && m.flags.has('\\Sent')) || m.path.toLowerCase().includes('sent'));
      const targetPath = sentBox ? sentBox.path : folder;
      await client.append(targetPath, Buffer.from(rawRfc822), ['\\Seen']);
    } catch (e) {}
  }

  checkAttachmentsInStructure(struct) {
    if (!struct) return false;
    if (struct.disposition && struct.disposition.type && struct.disposition.type.toLowerCase() === 'attachment') {
      return true;
    }
    if (struct.parameters && struct.parameters.name) {
      return true;
    }
    if (Array.isArray(struct.childNodes)) {
      return struct.childNodes.some(c => this.checkAttachmentsInStructure(c));
    }
    return false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = new ImapService();
