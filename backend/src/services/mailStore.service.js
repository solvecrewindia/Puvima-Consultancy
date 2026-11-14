/**
 * Puvima IT Service and Research Consultancy — Corporate Mailbox Store Service
 * Resilient, persistent local mailbox storage for PUVIMA Corporate Mail.
 * Integrates dynamic website inquiries, internship applications, and corporate correspondence.
 */

const fs = require('fs');
const path = require('path');

function resolveDataDir() {
  const candidates = [
    path.resolve(__dirname, '../../data'),
    path.resolve(__dirname, '../../../backend/data'),
    path.resolve(process.cwd(), 'backend/data'),
    path.resolve(process.cwd(), 'data')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.resolve(__dirname, '../../data');
}

const DATA_DIR = resolveDataDir();
const MAILBOX_FILE = path.join(DATA_DIR, 'mailbox.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'internship-applications.json');

class MailStoreService {
  constructor() {
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (e) {}
    }

    if (!fs.existsSync(MAILBOX_FILE)) {
      const initial = this.getDefaultSeedMessages();
      try {
        fs.writeFileSync(MAILBOX_FILE, JSON.stringify(initial, null, 2), 'utf8');
      } catch (e) {
        console.warn('[MailStore] Unable to write initial mailbox.json:', e.message);
      }
    }
  }

  getDefaultSeedMessages() {
    const now = Date.now();
    return [
      {
        uid: 'msg-101',
        seq: 1,
        folder: 'INBOX',
        subject: 'Welcome to PUVIMA Corporate Mail Gateway',
        from: { name: 'PUVIMA Executive Board', address: 'board@puvima.com' },
        to: [{ name: 'Principal Consultant', address: 'admin@puvima.com' }],
        date: new Date(now - 30 * 60 * 1000).toISOString(),
        size: 14200,
        isRead: true,
        isStarred: true,
        hasAttachments: false,
        snippet: 'Welcome to the official PUVIMA IT Service and Research Consultancy corporate mail system. All client correspondence, proposals, and notifications are routed here.',
        bodyHtml: `
          <div style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.6; max-width: 680px;">
            <div style="border-bottom: 2px solid #1A73E8; padding-bottom: 16px; margin-bottom: 20px;">
              <h2 style="color: #0B57D0; margin: 0 0 6px 0; font-size: 20px;">PUVIMA IT Service and Research Consultancy</h2>
              <span style="font-size: 12px; color: #5F6368; letter-spacing: 0.5px; text-transform: uppercase;">Official Corporate Communications</span>
            </div>
            <p>Welcome to <strong>PUVIMA Mail</strong> &mdash; the unified email client for Puvima IT Service and Research Consultancy.</p>
            <p>Your mailbox provides access to all corporate communications across our enterprise divisions:</p>
            <ul style="padding-left: 20px; line-height: 1.8;">
              <li><strong>Client Inquiries &amp; RFPs:</strong> Direct synchronization with website contact requests.</li>
              <li><strong>Research &amp; Technical Consulting:</strong> Academic and industry collaboration proposals.</li>
              <li><strong>GoDaddy Gateway:</strong> Live IMAP (<code>imap.secureserver.net:993</code>) &amp; SMTP (<code>smtpout.secureserver.net:465</code>) connectivity.</li>
              <li><strong>Talent &amp; Internship Pipeline:</strong> Real-time notifications for candidate submissions.</li>
            </ul>
            <div style="background: #F8F9FA; border-left: 4px solid #1A73E8; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
              <strong style="color: #1A73E8; display: block; margin-bottom: 4px;">Security Notice:</strong>
              <span style="font-size: 13px; color: #3C4043;">All transmissions are encrypted via 256-bit TLS 1.3. For questions or technical support, contact the IT administration team.</span>
            </div>
            <p style="margin-top: 24px; color: #5F6368; font-size: 13px;">Warm regards,<br><strong>Executive Board</strong><br>Puvima IT Service and Research Consultancy</p>
          </div>
        `,
        bodyText: 'Welcome to PUVIMA Corporate Mail Gateway.\n\nAll client correspondence, proposals, and system alerts are securely routed through this client.'
      },
      {
        uid: 'msg-102',
        seq: 2,
        folder: 'INBOX',
        subject: 'Client RFP: Enterprise Predictive Analytics & Automated Pipeline',
        from: { name: 'Dr. Rajiv Menon', address: 'rajiv.menon@nexussolutions.com' },
        to: [{ name: 'PUVIMA IT Solutions', address: 'contact@puvima.com' }],
        date: new Date(now - 3 * 3600 * 1000).toISOString(),
        size: 24800,
        isRead: false,
        isStarred: true,
        hasAttachments: false,
        snippet: 'We reviewed PUVIMA IT Service and Research Consultancy\'s technical portfolio and would like to invite your team to submit a proposal for our upcoming cloud pipeline...',
        bodyHtml: `
          <div style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.6; max-width: 680px;">
            <p>Dear Principal Consultant &amp; Technical Team,</p>
            <p>We recently reviewed your research portfolio in predictive analytics and automated systems architecture. We are currently evaluating partners for our Q1 2027 enterprise data modernization initiative.</p>
            <p><strong>Key Requirements:</strong></p>
            <ol style="padding-left: 20px; line-height: 1.8;">
              <li>High-throughput real-time data ingestion architecture.</li>
              <li>AI/ML predictive model deployment pipeline with sub-50ms inference.</li>
              <li>Comprehensive cloud security compliance and disaster recovery.</li>
            </ol>
            <p>Could we schedule a 30-minute discovery call this Thursday at 14:00 IST to discuss scope and timelines?</p>
            <p style="margin-top: 20px;">Sincerely,<br><strong>Dr. Rajiv Menon</strong><br>VP of Technology, Nexus Solutions Global</p>
          </div>
        `,
        bodyText: 'Dear Principal Consultant,\n\nWe would like to invite your team to submit a proposal for our enterprise data pipeline.\n\nPlease let us know your availability for a discovery call.'
      },
      {
        uid: 'msg-103',
        seq: 3,
        folder: 'INBOX',
        subject: 'Joint Research Proposal: Autonomous Robotics Navigation Architecture',
        from: { name: 'Prof. K. Venkatesh', address: 'k.venkatesh@iitm.ac.in' },
        to: [{ name: 'Research Advisory Board', address: 'admin@puvima.com' }],
        date: new Date(now - 18 * 3600 * 1000).toISOString(),
        size: 18500,
        isRead: false,
        isStarred: false,
        hasAttachments: false,
        snippet: 'Following our discussion at the IEEE symposium, we are sharing the draft application for collaborative research in autonomous path planning and sensor fusion...',
        bodyHtml: `
          <div style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.6; max-width: 680px;">
            <p>Dear Dr. Sundaram &amp; Research Colleagues,</p>
            <p>Following our productive discussion regarding autonomous navigation algorithms, our department has finalized the preliminary draft for the joint grant application under the Robotics &amp; AI Research Framework.</p>
            <p>The proposed study will investigate robust sensor fusion across LiDAR and optical vision systems under degraded environmental conditions.</p>
            <p>Please review the enclosed milestones and let us know your team's feedback so we can incorporate them prior to final submission.</p>
            <p style="margin-top: 20px;">With regards,<br><strong>Prof. K. Venkatesh</strong><br>Department of Engineering &amp; Robotics Research</p>
          </div>
        `,
        bodyText: 'Dear Colleagues,\n\nFollowing our discussion, we have finalized the preliminary draft for the joint grant application in autonomous robotics navigation.'
      },
      {
        uid: 'msg-104',
        seq: 4,
        folder: 'INBOX',
        subject: 'Weekly Candidate Shortlist: 7 Research Internship Applications Pending Review',
        from: { name: 'PUVIMA HR Operations', address: 'hr@puvima.com' },
        to: [{ name: 'SuperAdmin', address: 'admin@puvima.com' }],
        date: new Date(now - 42 * 3600 * 1000).toISOString(),
        size: 12100,
        isRead: true,
        isStarred: false,
        hasAttachments: false,
        snippet: 'The candidate screening for the Summer 2026 AI/ML Research Internship cohort has been completed. 7 shortlisted candidates are queued in the Onboarding portal...',
        bodyHtml: `
          <div style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.6; max-width: 680px;">
            <p>Hello Leadership Team,</p>
            <p>HR Operations has concluded the technical pre-screening for the latest batch of internship applicants. A total of <strong>7 candidates</strong> have met all domain prerequisites across AI/ML, Robotics, and Web Development.</p>
            <div style="background: #E8F0FE; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <span style="font-weight: 600; color: #0B57D0;">Action Required:</span>
              <p style="margin: 4px 0 0 0; font-size: 13.5px; color: #1F1F1F;">Please review candidate profiles in the <strong>Company HR Portal &rarr; Internship Applications</strong> to finalize interview schedules.</p>
            </div>
            <p style="color: #5F6368; font-size: 13px;">Best regards,<br><strong>Ananya Sharma</strong><br>HR Operations | Puvima IT Service and Research Consultancy</p>
          </div>
        `,
        bodyText: 'Hello Leadership Team,\n\nHR Operations has screened 7 candidates for the Research Internship. Profiles are ready in the HR portal.'
      },
      {
        uid: 'msg-105',
        seq: 5,
        folder: 'INBOX',
        subject: 'System Status: Cloud Infrastructure & Supabase Services Operational',
        from: { name: 'PUVIMA System Monitor', address: 'noreply@puvima.com' },
        to: [{ name: 'Principal Consultant', address: 'admin@puvima.com' }],
        date: new Date(now - 72 * 3600 * 1000).toISOString(),
        size: 9800,
        isRead: true,
        isStarred: false,
        hasAttachments: false,
        snippet: 'All microservices, databases, and SSL endpoints are running at 99.98% uptime. Supabase connection verified and healthy.',
        bodyHtml: `
          <div style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.6; max-width: 680px;">
            <p><strong>System Health Audit &mdash; All Services Nominal</strong></p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
              <thead>
                <tr style="border-bottom: 2px solid #DADCE0; text-align: left; color: #5F6368;">
                  <th style="padding: 8px 12px;">Component</th>
                  <th style="padding: 8px 12px;">Status</th>
                  <th style="padding: 8px 12px;">Latency</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #F1F3F4;">
                  <td style="padding: 8px 12px;">Main Web App (Port 5000)</td>
                  <td style="padding: 8px 12px; color: #188038; font-weight: 600;">ACTIVE</td>
                  <td style="padding: 8px 12px;">8 ms</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F3F4;">
                  <td style="padding: 8px 12px;">Supabase Cloud Database</td>
                  <td style="padding: 8px 12px; color: #188038; font-weight: 600;">CONNECTED</td>
                  <td style="padding: 8px 12px;">42 ms</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F3F4;">
                  <td style="padding: 8px 12px;">GoDaddy Gateway Dispatch</td>
                  <td style="padding: 8px 12px; color: #188038; font-weight: 600;">READY</td>
                  <td style="padding: 8px 12px;">120 ms</td>
                </tr>
              </tbody>
            </table>
            <p style="font-size: 12px; color: #70757A;">Generated automatically by PUVIMA Enterprise Monitoring Agent.</p>
          </div>
        `,
        bodyText: 'System Health Audit: All services operational. Main Web App: ACTIVE. Supabase Cloud Database: CONNECTED.'
      }
    ];
  }

  readAll() {
    this.ensureFile();
    let messages = [];
    try {
      const raw = fs.readFileSync(MAILBOX_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      messages = Array.isArray(parsed) ? parsed : this.getDefaultSeedMessages();
    } catch (e) {
      messages = this.getDefaultSeedMessages();
    }

    const prevCount = messages.length;
    messages = this.syncWebsiteInquiries(messages);
    if (messages.length !== prevCount) {
      this.saveAll(messages);
    }

    return messages;
  }

  saveAll(messages) {
    this.ensureFile();
    try {
      fs.writeFileSync(MAILBOX_FILE, JSON.stringify(messages, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.warn('[MailStore] saveAll error:', e.message);
      return false;
    }
  }

  syncWebsiteInquiries(messages) {
    try {
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
        const contacts = data.contacts || [];
        for (const c of contacts) {
          const uid = `contact-${c.id || c.referenceId}`;
          if (!messages.some(m => m.uid === uid)) {
            messages.unshift({
              uid,
              seq: messages.length + 1,
              folder: 'INBOX',
              subject: `Website Inquiry: ${c.subject || c.service || 'New Contact Request'}`,
              from: { name: c.name || 'Website Visitor', address: c.email || 'visitor@example.com' },
              to: [{ name: 'PUVIMA Contact Team', address: 'contact@puvima.com' }],
              date: c.createdAt || new Date().toISOString(),
              size: 8500,
              isRead: false,
              isStarred: false,
              hasAttachments: false,
              snippet: c.message ? String(c.message).slice(0, 100) : 'New inquiry submitted on the PUVIMA website.',
              bodyHtml: `
                <div style="font-family: Roboto, sans-serif; color: #202124; line-height: 1.6;">
                  <p><strong>New Website Contact Form Submission</strong></p>
                  <p><strong>Name:</strong> ${c.name || 'N/A'}<br>
                  <strong>Email:</strong> ${c.email || 'N/A'}<br>
                  <strong>Phone:</strong> ${c.phone || 'N/A'}<br>
                  <strong>Service:</strong> ${c.service || 'General'}</p>
                  <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 16px 0;">
                  <p style="white-space: pre-wrap;">${c.message || ''}</p>
                </div>
              `,
              bodyText: `New Contact Request from ${c.name} (${c.email}):\n\n${c.message}`
            });
          }
        }
      }
    } catch (e) {}

    try {
      if (fs.existsSync(APPLICATIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(APPLICATIONS_FILE, 'utf8'));
        const apps = raw.applications || [];
        for (const a of apps) {
          const uid = `intern-${a.id || a.applicationId || a.email}`;
          if (!messages.some(m => m.uid === uid)) {
            messages.unshift({
              uid,
              seq: messages.length + 1,
              folder: 'INBOX',
              subject: `New Internship Application: ${a.fullName || a.name || 'Candidate'} (${a.domain || 'Research'})`,
              from: { name: a.fullName || a.name || 'Applicant', address: a.email || 'candidate@example.com' },
              to: [{ name: 'PUVIMA HR Operations', address: 'hr@puvima.com' }],
              date: a.createdAt || new Date().toISOString(),
              size: 11200,
              isRead: false,
              isStarred: false,
              hasAttachments: Boolean(a.resumeUrl || a.resumeName),
              snippet: `Candidate submitted application for ${a.domain || 'Research'} internship. College: ${a.college || 'N/A'}.`,
              bodyHtml: `
                <div style="font-family: Roboto, sans-serif; color: #202124; line-height: 1.6;">
                  <p><strong>New Internship Application Received</strong></p>
                  <p><strong>Candidate:</strong> ${a.fullName || a.name}<br>
                  <strong>Email:</strong> ${a.email}<br>
                  <strong>Phone:</strong> ${a.phone || 'N/A'}<br>
                  <strong>Domain:</strong> ${a.domain || 'Research'}<br>
                  <strong>Institution:</strong> ${a.college || 'N/A'}</p>
                  <p>Candidate status: <strong>${a.status || 'Pending Review'}</strong></p>
                </div>
              `,
              bodyText: `Internship Application from ${a.fullName} (${a.email}) for ${a.domain}.`
            });
          }
        }
      }
    } catch (e) {}

    return messages;
  }

  getMessages(folder = 'INBOX', options = {}, userEmail = 'admin@puvima.com') {
    let all = this.readAll();

    const targetFolder = String(folder || 'INBOX').trim().toLowerCase();
    const { page = 1, limit = 50, search = '' } = options;

    let filtered = all.filter(m => {
      if (m.deleted || (m.folder || '').toLowerCase() === 'deleted') return false;
      if (targetFolder === 'starred') {
        return m.isStarred && (m.folder || '').toLowerCase() !== 'trash';
      }
      if (targetFolder === 'scheduled') {
        return (m.folder || '').toLowerCase() === 'scheduled';
      }
      if (targetFolder === 'inbox') {
        return (m.folder || 'INBOX').toUpperCase() === 'INBOX';
      }
      return (m.folder || '').toLowerCase() === targetFolder;
    });

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.snippet && m.snippet.toLowerCase().includes(q)) ||
        (m.from && (m.from.name.toLowerCase().includes(q) || m.from.address.toLowerCase().includes(q)))
      );
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paged = filtered.slice(startIndex, startIndex + limit);

    const inboxCount = all.filter(m => (m.folder || 'INBOX').toUpperCase() === 'INBOX' && !m.isRead).length;

    return {
      messages: paged,
      total,
      page,
      limit,
      unreadCount: inboxCount
    };
  }

  getMessage(folder, uid, markAsRead = true, userEmail = 'admin@puvima.com') {
    let all = this.readAll();
    const msg = all.find(m => String(m.uid) === String(uid));
    if (!msg) return null;

    if (markAsRead && !msg.isRead) {
      msg.isRead = true;
      this.saveAll(all);
    }

    return msg;
  }

  sendMessage(data, userEmail = 'admin@puvima.com') {
    const all = this.readAll();
    const isPrincipal = (userEmail || '').toLowerCase().includes('admin@puvima.com');
    const senderName = isPrincipal ? 'Principal Consultant' : 'PUVIMA';

    const normalizeRecipientList = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.map(r => (typeof r === 'string' ? { name: r.trim(), address: r.trim() } : r));
      }
      return String(input)
        .split(/[,;\n\r]+/)
        .map(e => e.trim())
        .filter(Boolean)
        .map(e => ({ name: e, address: e }));
    };

    const toRecipients = normalizeRecipientList(data.to);
    const ccRecipients = normalizeRecipientList(data.cc);
    const bccRecipients = normalizeRecipientList(data.bcc);

    const newMsg = {
      uid: `sent-${Date.now()}`,
      seq: all.length + 1,
      folder: 'Sent',
      subject: data.subject || '(No Subject)',
      from: { name: senderName, address: userEmail },
      to: toRecipients.length > 0 ? toRecipients : [{ name: 'Recipient', address: 'recipient@puvima.com' }],
      cc: ccRecipients,
      bcc: bccRecipients,
      date: new Date().toISOString(),
      size: (data.text ? data.text.length : 100) + 2048,
      isRead: true,
      isStarred: false,
      hasAttachments: Boolean(data.attachments && data.attachments.length > 0),
      snippet: data.text ? data.text.slice(0, 100) : data.subject,
      bodyHtml: data.html || `<div style="font-family: Roboto, sans-serif; white-space: pre-wrap;">${data.text || ''}</div>`,
      bodyText: data.text || ''
    };

    all.unshift(newMsg);
    this.saveAll(all);
    return newMsg;
  }

  markRead(uid, isRead = true) {
    const all = this.readAll();
    const msg = all.find(m => String(m.uid) === String(uid));
    if (msg) {
      msg.isRead = Boolean(isRead);
      this.saveAll(all);
      return { success: true, uid, isRead: msg.isRead };
    }
    return { success: false, message: 'Message not found.' };
  }

  markStarred(uid, isStarred = true) {
    const all = this.readAll();
    const msg = all.find(m => String(m.uid) === String(uid));
    if (msg) {
      msg.isStarred = Boolean(isStarred);
      this.saveAll(all);
      return { success: true, uid, isStarred: msg.isStarred };
    }
    return { success: false, message: 'Message not found.' };
  }

  moveToTrash(uid) {
    const all = this.readAll();
    const msg = all.find(m => String(m.uid) === String(uid));
    if (msg) {
      if ((msg.folder || '').toLowerCase() === 'trash') {
        msg.folder = 'Deleted';
        msg.deleted = true;
        this.saveAll(all);
        return { success: true, uid, deleted: true, permanent: true };
      } else {
        msg.folder = 'Trash';
        this.saveAll(all);
        return { success: true, uid, folder: 'Trash' };
      }
    }
    return { success: false, message: 'Message not found.' };
  }

  batchMoveToTrash(uids = []) {
    const all = this.readAll();
    const uidSet = new Set(uids.map(u => String(u)));
    let count = 0;

    for (const msg of all) {
      if (uidSet.has(String(msg.uid))) {
        if ((msg.folder || '').toLowerCase() === 'trash') {
          msg.folder = 'Deleted';
          msg.deleted = true;
        } else {
          msg.folder = 'Trash';
        }
        count++;
      }
    }

    this.saveAll(all);
    return { success: true, count };
  }

  restoreFromTrash(uid) {
    const all = this.readAll();
    const msg = all.find(m => String(m.uid) === String(uid));
    if (msg) {
      msg.folder = 'INBOX';
      msg.deleted = false;
      this.saveAll(all);
      return { success: true, uid, folder: 'INBOX' };
    }
    return { success: false, message: 'Message not found.' };
  }

  batchRestore(uids = []) {
    const all = this.readAll();
    const uidSet = new Set(uids.map(u => String(u)));
    let count = 0;

    for (const msg of all) {
      if (uidSet.has(String(msg.uid))) {
        msg.folder = 'INBOX';
        msg.deleted = false;
        count++;
      }
    }

    this.saveAll(all);
    return { success: true, count };
  }
}

module.exports = new MailStoreService();
