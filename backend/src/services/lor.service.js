/**
 * Puvima IT Service and Research Consultancy — Letter of Recommendation (LOR) & Professor Endorsement Service
 * Handles candidate LOR application, automated professor email dispatch with verification token,
 * professor endorsement confirmation, and HR approval/issuance lifecycle.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const smtpService = require('./smtp.service');
const { getSupabase } = require('../config/supabase');

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_PATH = path.resolve(DATA_DIR, 'lor_requests.json');

class LorService {
  constructor() {
    this.ensureStore();
  }

  ensureStore() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = {
        requests: [],
        audit: []
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  readLocalStore() {
    try {
      this.ensureStore();
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return { requests: [], audit: [] };
    }
  }

  writeLocalStore(data) {
    try {
      this.ensureStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[LorService] Local store write error:', e.message);
    }
  }

  generateReadableId() {
    const year = new Date().getFullYear();
    const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PV-LOR-${year}-${hex}`;
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // 1. Create or Update LOR Request from Intern
  async submitLorRequest(internUser, payload) {
    if (!internUser || !internUser.email) {
      throw new Error('Intern credentials required.');
    }

    const {
      professor_name,
      professor_designation,
      professor_department,
      professor_institution,
      professor_phone,
      professor_email,
      academic_relationship,
      domain_specialization,
      college_university,
      department_branch,
      internship_start_date,
      internship_end_date,
      project_title,
      project_deliverables,
      purpose_of_lor
    } = payload || {};

    if (!professor_name || !professor_email || !professor_institution) {
      throw new Error('Professor Name, Email, and Institution are mandatory.');
    }

    const cleanProfEmail = String(professor_email).trim().toLowerCase();
    const cleanInternEmail = String(internUser.email).trim().toLowerCase();

    const store = this.readLocalStore();
    let record = store.requests.find(r => r.intern_email.toLowerCase() === cleanInternEmail && r.status !== 'Rejected');

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days valid

    if (!record) {
      record = {
        id: crypto.randomUUID(),
        lor_request_id: this.generateReadableId(),
        intern_id: internUser.id || null,
        intern_email: cleanInternEmail,
        intern_name: internUser.name || payload.intern_name || 'Intern',
        intern_phone: internUser.phone || payload.intern_phone || '',
        domain_specialization: domain_specialization || 'Software & Research Engineering',
        college_university: college_university || 'Institution',
        department_branch: department_branch || '',
        internship_start_date: internship_start_date || '2026-01-01',
        internship_end_date: internship_end_date || 'Present',
        project_title: project_title || 'Advanced Technical Initiative',
        project_deliverables: project_deliverables || 'Design, engineering analysis, and implementation.',
        purpose_of_lor: purpose_of_lor || 'Higher Studies & Career Placement',

        professor_name: professor_name.trim(),
        professor_designation: (professor_designation || 'Faculty Guide').trim(),
        professor_department: (professor_department || 'Engineering').trim(),
        professor_institution: professor_institution.trim(),
        professor_phone: (professor_phone || '').trim(),
        professor_email: cleanProfEmail,
        academic_relationship: (academic_relationship || 'Project Guide / Faculty Mentor').trim(),

        verification_token: this.generateToken(),
        token_expires_at: expiresAt,
        status: 'Draft',

        email_sent_at: null,
        email_delivery_status: 'Pending Dispatch',
        professor_confirmed_at: null,
        professor_endorsement_remarks: null,
        professor_rating: null,
        professor_ip_address: null,

        hr_verified_by: null,
        hr_verified_at: null,
        hr_remarks: null,

        created_at: now,
        updated_at: now
      };
      store.requests.unshift(record);
    } else {
      // Update existing record
      record.intern_name = internUser.name || payload.intern_name || record.intern_name;
      record.intern_phone = payload.intern_phone || record.intern_phone;
      record.domain_specialization = domain_specialization || record.domain_specialization;
      record.college_university = college_university || record.college_university;
      record.department_branch = department_branch || record.department_branch;
      record.internship_start_date = internship_start_date || record.internship_start_date;
      record.internship_end_date = internship_end_date || record.internship_end_date;
      record.project_title = project_title || record.project_title;
      record.project_deliverables = project_deliverables || record.project_deliverables;
      record.purpose_of_lor = purpose_of_lor || record.purpose_of_lor;

      record.professor_name = professor_name.trim();
      record.professor_designation = (professor_designation || record.professor_designation).trim();
      record.professor_department = (professor_department || record.professor_department).trim();
      record.professor_institution = professor_institution.trim();
      record.professor_phone = (professor_phone || record.professor_phone).trim();
      record.professor_email = cleanProfEmail;
      record.academic_relationship = (academic_relationship || record.academic_relationship).trim();

      if (record.status === 'Draft' || record.status === 'Declined by Professor') {
        record.verification_token = this.generateToken();
        record.token_expires_at = expiresAt;
      }
      record.updated_at = now;
    }

    this.writeLocalStore(store);
    this.addAuditEntry(record.id, 'LOR Request Submitted', internUser.name || 'Intern', 'Intern', `Nominated Prof. ${record.professor_name}`);

    // Sync to Supabase in background
    this.syncToSupabase(record).catch(() => {});

    return record;
  }

  // 2. Dispatch Automated Email to Professor
  async sendProfessorVerificationEmail(lorIdOrEmail, hostOrigin = 'http://localhost:5000') {
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.id === lorIdOrEmail || r.intern_email.toLowerCase() === String(lorIdOrEmail).toLowerCase());
    if (!lor) throw new Error('LOR request not found.');

    const confirmUrl = `${hostOrigin}/company/lorconfirm?token=${lor.verification_token}`;
    const subject = `[Puvima IT Service and Research Consultancy] Academic Mentor Verification Request for ${lor.intern_name}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; color: #0F172A; }
          .container { max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06); }
          .header { background: #001D35; color: #FFFFFF; padding: 28px 24px; text-align: center; border-bottom: 3px solid #D97706; }
          .header h1 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0; font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; }
          .body { padding: 32px 28px; line-height: 1.6; }
          .salutation { font-size: 15px; font-weight: 700; color: #001D35; margin-bottom: 12px; }
          .profile-card { background: #F1F5F9; border-radius: 8px; border-left: 4px solid #001D35; padding: 16px 20px; margin: 20px 0; }
          .profile-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .profile-row:last-child { margin-bottom: 0; }
          .profile-label { color: #64748B; font-weight: 600; width: 40%; }
          .profile-val { color: #0F172A; font-weight: 700; width: 60%; }
          .action-box { text-align: center; margin: 32px 0 24px; }
          .btn-confirm { display: inline-block; background: #001D35; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,29,53,0.25); }
          .btn-confirm:hover { background: #003E7E; }
          .direct-link { font-size: 11px; color: #64748B; word-break: break-all; margin-top: 14px; }
          .footer { background: #F8FAFC; padding: 20px; font-size: 11px; color: #64748B; text-align: center; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PUVIMA IT SERVICE AND RESEARCH CONSULTANCY</h1>
            <p>Official Academic Mentor Verification Portal</p>
          </div>
          <div class="body">
            <div class="salutation">Respected Professor ${lor.professor_name},</div>
            <p style="font-size: 13.5px; color: #334155;">
              Greetings from <strong>Puvima IT Service and Research Consultancy</strong>. Your student, <strong>${lor.intern_name}</strong>, has successfully undertaken research and engineering engagement with us in the domain of <strong>${lor.domain_specialization}</strong>.
            </p>
            <p style="font-size: 13.5px; color: #334155;">
              The student has applied for an official <strong>PUVIMA Letter of Recommendation (LOR)</strong> and has nominated you as their Academic Supervisor / Faculty Guide (${lor.academic_relationship}) from <strong>${lor.professor_institution}</strong>.
            </p>
            
            <div class="profile-card">
              <div style="font-size: 12px; font-weight: 800; color: #001D35; margin-bottom: 12px; text-transform: uppercase;">
                Student &amp; Engagement Summary
              </div>
              <div class="profile-row"><span class="profile-label">Student Name:</span><span class="profile-val">${lor.intern_name}</span></div>
              <div class="profile-row"><span class="profile-label">Institution:</span><span class="profile-val">${lor.college_university}</span></div>
              <div class="profile-row"><span class="profile-label">Specialization:</span><span class="profile-val">${lor.domain_specialization}</span></div>
              <div class="profile-row"><span class="profile-label">Project Title:</span><span class="profile-val">${lor.project_title}</span></div>
              <div class="profile-row"><span class="profile-label">Tenure:</span><span class="profile-val">${lor.internship_start_date} to ${lor.internship_end_date}</span></div>
              <div class="profile-row"><span class="profile-label">LOR Purpose:</span><span class="profile-val">${lor.purpose_of_lor}</span></div>
            </div>

            <p style="font-size: 13px; color: #334155;">
              To endorse this student for their official PUVIMA Letter of Recommendation, please review their profile and confirm your endorsement using our secure one-click portal:
            </p>

            <div class="action-box">
              <a href="${confirmUrl}" class="btn-confirm" target="_blank">
                Review &amp; Confirm Endorsement &rarr;
              </a>
              <div class="direct-link">
                Or copy link: <a href="${confirmUrl}" style="color: #0B57D0;">${confirmUrl}</a>
              </div>
            </div>

            <p style="font-size: 11.5px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 16px;">
              * Note: This endorsement link is uniquely signed for <strong>${lor.professor_email}</strong> and valid for 30 days. No account registration or password is required.
            </p>
          </div>
          <div class="footer">
            Puvima IT Service and Research Consultancy • Mail: contact@puvima.com • Web: www.puvima.com<br>
            Reference: ${lor.lor_request_id}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Puvima IT Service and Research Consultancy
Official Academic Mentor Verification

Respected Professor ${lor.professor_name},

Your student ${lor.intern_name} (${lor.college_university}) has applied for an official PUVIMA Letter of Recommendation (LOR) for ${lor.purpose_of_lor} and nominated you as Faculty Mentor.

Please confirm your endorsement at the secure link below:
${confirmUrl}

Thank you,
Puvima IT Service and Research Consultancy
contact@puvima.com
Reference: ${lor.lor_request_id}
    `;

    let delivered = false;
    let deliveryNote = '';

    try {
      if (smtpService.isConfigured()) {
        await smtpService.sendMail({
          to: lor.professor_email,
          subject,
          text,
          html
        });
        delivered = true;
        deliveryNote = `Dispatched successfully to ${lor.professor_email}`;
      } else {
        deliveryNote = `SMTP transport idle in environment. Direct confirmation link generated: ${confirmUrl}`;
      }
    } catch (e) {
      deliveryNote = `Outbound dispatch note (${e.message}). Direct confirmation link: ${confirmUrl}`;
      console.warn('[LorService] Outbound email note:', e.message);
    }

    const now = new Date().toISOString();
    lor.status = 'Email Sent to Professor';
    lor.email_sent_at = now;
    lor.email_delivery_status = deliveryNote;
    lor.updated_at = now;
    lor.direct_confirmation_url = confirmUrl;

    this.writeLocalStore(store);
    this.addAuditEntry(lor.id, 'Email Sent to Professor', 'PUVIMA System', 'System', deliveryNote);
    this.syncToSupabase(lor).catch(() => {});

    return {
      success: true,
      delivered,
      status: lor.status,
      confirmation_url: confirmUrl,
      delivery_note: deliveryNote
    };
  }

  // 3. Lookup LOR for Professor Verification Page by Token
  async getLorByToken(token) {
    if (!token) throw new Error('Verification token required.');
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.verification_token === token);
    if (!lor) throw new Error('Invalid or expired verification token.');

    // Check expiry
    if (lor.token_expires_at && new Date() > new Date(lor.token_expires_at)) {
      throw new Error('This verification link has expired. Please ask the intern to resend the request.');
    }

    return {
      lor_request_id: lor.lor_request_id,
      intern_name: lor.intern_name,
      domain_specialization: lor.domain_specialization,
      college_university: lor.college_university,
      department_branch: lor.department_branch,
      internship_start_date: lor.internship_start_date,
      internship_end_date: lor.internship_end_date,
      project_title: lor.project_title,
      project_deliverables: lor.project_deliverables,
      purpose_of_lor: lor.purpose_of_lor,
      professor_name: lor.professor_name,
      professor_designation: lor.professor_designation,
      professor_institution: lor.professor_institution,
      professor_email: lor.professor_email,
      academic_relationship: lor.academic_relationship,
      status: lor.status,
      professor_confirmed_at: lor.professor_confirmed_at,
      professor_endorsement_remarks: lor.professor_endorsement_remarks,
      professor_rating: lor.professor_rating
    };
  }

  // 4. Professor Confirms & Endorses Intern
  async confirmByProfessor(token, { remarks = '', rating = 'Strongly Recommended', ipAddress = '127.0.0.1' }) {
    if (!token) throw new Error('Verification token required.');
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.verification_token === token);
    if (!lor) throw new Error('Invalid verification token.');

    const now = new Date().toISOString();
    lor.status = 'Confirmed by Professor';
    lor.professor_confirmed_at = now;
    lor.professor_endorsement_remarks = remarks || 'Endorsed based on satisfactory academic and research standing.';
    lor.professor_rating = rating || 'Strongly Recommended';
    lor.professor_ip_address = ipAddress;
    lor.updated_at = now;

    this.writeLocalStore(store);
    this.addAuditEntry(lor.id, 'Confirmed by Professor', lor.professor_name, 'Professor', `Endorsed as ${lor.professor_rating}`);
    this.syncToSupabase(lor).catch(() => {});

    return {
      success: true,
      message: `Thank you, Professor ${lor.professor_name}! Your endorsement for ${lor.intern_name} has been securely recorded.`,
      lor_request_id: lor.lor_request_id,
      confirmed_at: now
    };
  }

  // 5. Professor Declines Request
  async declineByProfessor(token, { reason = '', ipAddress = '127.0.0.1' }) {
    if (!token) throw new Error('Verification token required.');
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.verification_token === token);
    if (!lor) throw new Error('Invalid verification token.');

    const now = new Date().toISOString();
    lor.status = 'Declined by Professor';
    lor.professor_endorsement_remarks = reason || 'Mentor unable to endorse at this time.';
    lor.professor_ip_address = ipAddress;
    lor.updated_at = now;

    this.writeLocalStore(store);
    this.addAuditEntry(lor.id, 'Declined by Professor', lor.professor_name, 'Professor', reason);
    this.syncToSupabase(lor).catch(() => {});

    return {
      success: true,
      message: 'Request declined.',
      lor_request_id: lor.lor_request_id
    };
  }

  // 6. Get Intern's LOR Request
  async getLorByInternEmail(email) {
    if (!email) return null;
    const store = this.readLocalStore();
    const clean = String(email).trim().toLowerCase();
    const record = store.requests.find(r => r.intern_email.toLowerCase() === clean);
    if (!record) return null;

    const audit = store.audit.filter(a => a.lor_id === record.id);
    return { ...record, audit };
  }

  // 7. HR: List All LOR Requests
  async getHrLorRequests({ search = '', status = '', page = 1, limit = 25 }) {
    const store = this.readLocalStore();
    let list = [...store.requests];

    if (status && status !== 'all') {
      list = list.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.lor_request_id && r.lor_request_id.toLowerCase().includes(q)) ||
        (r.intern_name && r.intern_name.toLowerCase().includes(q)) ||
        (r.intern_email && r.intern_email.toLowerCase().includes(q)) ||
        (r.professor_name && r.professor_name.toLowerCase().includes(q)) ||
        (r.professor_email && r.professor_email.toLowerCase().includes(q)) ||
        (r.college_university && r.college_university.toLowerCase().includes(q))
      );
    }

    const total = list.length;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return {
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      requests: paginated
    };
  }

  // 8. HR: Get Stats
  async getHrStats() {
    const store = this.readLocalStore();
    const all = store.requests;
    return {
      total: all.length,
      pending_professor: all.filter(r => r.status === 'Email Sent to Professor' || r.status === 'Draft').length,
      confirmed_by_professor: all.filter(r => r.status === 'Confirmed by Professor').length,
      hr_approved: all.filter(r => r.status === 'HR Approved' || r.status === 'LOR Issued').length,
      declined: all.filter(r => r.status === 'Declined by Professor' || r.status === 'Rejected').length
    };
  }

  // 9. HR: Approve and Issue LOR
  async approveByHr(lorId, hrUser, { hrRemarks = '' } = {}) {
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.id === lorId || r.lor_request_id === lorId);
    if (!lor) throw new Error('LOR request not found.');

    const now = new Date().toISOString();
    lor.status = 'HR Approved';
    lor.hr_verified_by = hrUser ? (hrUser.name || hrUser.email) : 'HR Lead';
    lor.hr_verified_at = now;
    lor.hr_remarks = hrRemarks || 'Academic credentials and professor endorsement cleared.';
    lor.updated_at = now;

    this.writeLocalStore(store);
    this.addAuditEntry(lor.id, 'HR Approved & Issued', lor.hr_verified_by, 'HR', lor.hr_remarks);
    this.syncToSupabase(lor).catch(() => {});

    return lor;
  }

  // 10. HR: Reject Request
  async rejectByHr(lorId, hrUser, { hrRemarks = '' } = {}) {
    const store = this.readLocalStore();
    const lor = store.requests.find(r => r.id === lorId || r.lor_request_id === lorId);
    if (!lor) throw new Error('LOR request not found.');

    const now = new Date().toISOString();
    lor.status = 'Rejected';
    lor.hr_verified_by = hrUser ? (hrUser.name || hrUser.email) : 'HR Lead';
    lor.hr_verified_at = now;
    lor.hr_remarks = hrRemarks || 'Does not meet PUVIMA LOR issuance criteria.';
    lor.updated_at = now;

    this.writeLocalStore(store);
    this.addAuditEntry(lor.id, 'HR Rejected', lor.hr_verified_by, 'HR', lor.hr_remarks);
    this.syncToSupabase(lor).catch(() => {});

    return lor;
  }

  // 11. Add Audit Log
  addAuditEntry(lorId, action, actor, actorRole, remarks) {
    const store = this.readLocalStore();
    store.audit.push({
      id: crypto.randomUUID(),
      lor_id: lorId,
      action,
      actor,
      actor_role: actorRole,
      remarks,
      created_at: new Date().toISOString()
    });
    this.writeLocalStore(store);
  }

  // 12. Supabase Cloud Sync
  async syncToSupabase(record) {
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase
        .from('company_lor_requests')
        .upsert({
          id: record.id,
          lor_request_id: record.lor_request_id,
          intern_id: record.intern_id,
          intern_email: record.intern_email,
          intern_name: record.intern_name,
          intern_phone: record.intern_phone,
          domain_specialization: record.domain_specialization,
          college_university: record.college_university,
          department_branch: record.department_branch,
          internship_start_date: record.internship_start_date,
          internship_end_date: record.internship_end_date,
          project_title: record.project_title,
          project_deliverables: record.project_deliverables,
          purpose_of_lor: record.purpose_of_lor,
          professor_name: record.professor_name,
          professor_designation: record.professor_designation,
          professor_department: record.professor_department,
          professor_institution: record.professor_institution,
          professor_phone: record.professor_phone,
          professor_email: record.professor_email,
          academic_relationship: record.academic_relationship,
          verification_token: record.verification_token,
          token_expires_at: record.token_expires_at,
          status: record.status,
          email_sent_at: record.email_sent_at,
          email_delivery_status: record.email_delivery_status,
          professor_confirmed_at: record.professor_confirmed_at,
          professor_endorsement_remarks: record.professor_endorsement_remarks,
          professor_rating: record.professor_rating,
          professor_ip_address: record.professor_ip_address,
          hr_verified_by: record.hr_verified_by,
          hr_verified_at: record.hr_verified_at,
          hr_remarks: record.hr_remarks,
          updated_at: record.updated_at
        });
    } catch (e) {
      // Graceful local store fallback active
    }
  }
}

module.exports = new LorService();

