/**
 * Puvima IT Service and Research Consultancy — Enterprise Onboarding & HR Verification Service
 * Supports complete applicant onboarding lifecycle:
 * Application -> Multi-Step Details -> Document Upload -> Verification -> Approval/Rejection.
 * Connected to Supabase Cloud with resilient local file fallback.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const emailService = require('./email.service');

const ONBOARDING_DIR = path.resolve(__dirname, '../../data/onboarding');
const APPS_FILE = path.join(ONBOARDING_DIR, 'applications.json');
const UPLOADS_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'puvima-onboarding-docs')
  : path.resolve(__dirname, '../../uploads/onboarding');

const ENCRYPTION_SECRET = process.env.ONBOARDING_ENCRYPTION_SECRET || process.env.ADMIN_JWT_SECRET || 'puvima-onboarding-secure-key-2026-enterprise';

class OnboardingService {
  constructor() {
    this.ensureStorage();
  }

  ensureStorage() {
    try {
      if (!fs.existsSync(ONBOARDING_DIR)) {
        fs.mkdirSync(ONBOARDING_DIR, { recursive: true });
      }
      if (!fs.existsSync(APPS_FILE)) {
        fs.writeFileSync(APPS_FILE, JSON.stringify({ applications: [], history: [], notifications: [] }, null, 2), 'utf8');
      }
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[OnboardingService] Local storage init note:', err.message);
    }
  }

  // --- CRYPTOGRAPHY & MASKING HELPERS ---

  maskIdNumber(idStr) {
    if (!idStr) return '';
    const clean = String(idStr).replace(/\s+/g, '');
    if (clean.length <= 4) return clean;
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }

  maskAccountNumber(accStr) {
    if (!accStr) return '';
    const clean = String(accStr).trim();
    if (clean.length <= 4) return clean;
    const last4 = clean.slice(-4);
    const maskedLen = Math.max(0, clean.length - 4);
    return 'X'.repeat(maskedLen) + last4;
  }

  encryptValue(text) {
    if (!text) return '';
    try {
      const key = crypto.scryptSync(ENCRYPTION_SECRET, 'puvima_salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(String(text), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (e) {
      return '';
    }
  }

  decryptValue(cipherText) {
    if (!cipherText || !cipherText.includes(':')) return '';
    try {
      const [ivHex, encHex] = cipherText.split(':');
      const key = crypto.scryptSync(ENCRYPTION_SECRET, 'puvima_salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      return '';
    }
  }

  generateApplicationId() {
    const year = new Date().getFullYear();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PV-ONB-${year}-${rand}`;
  }

  generateAccessToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  // --- LOCAL FALLBACK STORE HELPERS ---

  readLocalStore() {
    try {
      if (fs.existsSync(APPS_FILE)) {
        const raw = fs.readFileSync(APPS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return { applications: [], history: [], notifications: [] };
  }

  writeLocalStore(data) {
    try {
      fs.writeFileSync(APPS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  // --- AUDIT HISTORY & NOTIFICATIONS ---

  async recordHistory(applicationId, { userId = 'System', userRole = 'Applicant', action, previousStatus, newStatus, remarks = '' }) {
    const entry = {
      id: crypto.randomUUID(),
      application_id: applicationId,
      user_id: userId,
      user_role: userRole,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      remarks,
      created_at: new Date().toISOString()
    };

    // Try Supabase first
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('onboarding_verification_history').insert([entry]);
      } catch (e) {}
    }

    // Always mirror to local store
    const store = this.readLocalStore();
    store.history = store.history || [];
    store.history.unshift(entry);
    this.writeLocalStore(store);

    return entry;
  }

  async sendNotification({ recipientType, recipientEmail = null, applicationId, title, message, type = 'info' }) {
    const notif = {
      id: crypto.randomUUID(),
      recipient_type: recipientType,
      recipient_email: recipientEmail,
      application_id: applicationId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Try Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('onboarding_notifications').insert([notif]);
      } catch (e) {}
    }

    // Mirror to local store
    const store = this.readLocalStore();
    store.notifications = store.notifications || [];
    store.notifications.unshift(notif);
    this.writeLocalStore(store);

    // If recipient is applicant and email service configured, send email
    if (recipientType === 'applicant' && recipientEmail) {
      try {
        if (emailService && emailService.transporter) {
          await emailService.transporter.sendMail({
            from: `"PUVIMA HR Operations" <${process.env.MAIL_FROM || 'contact@puvima.com'}>`,
            to: recipientEmail,
            subject: `[PUVIMA Onboarding] ${title}`,
            text: `${message}\n\nPuvima IT Service and Research Consultancy\nWebsite: https://puvima.com`
          });
        }
      } catch (err) {
        console.warn('[OnboardingService] Notification email dispatch warning:', err.message);
      }
    }

    return notif;
  }

  // --- APPLICANT ONBOARDING WORKFLOW ---

  async initOrGetApplication(initData) {
    const { email, name, phone, position = 'Intern' } = initData || {};
    if (!email) throw new Error('Applicant email address is required.');

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();

    // Check existing application in local store
    const store = this.readLocalStore();
    let app = store.applications.find(a => a.applicant_email.toLowerCase() === cleanEmail && a.status !== 'Rejected');

    if (!app) {
      const newId = crypto.randomUUID();
      const appId = this.generateApplicationId();
      const token = this.generateAccessToken();

      app = {
        id: newId,
        application_id: appId,
        access_token: token,
        applicant_email: cleanEmail,
        applicant_name: cleanName || 'Applicant',
        applicant_phone: cleanPhone || '',
        position_applied: position,
        position_other: '',
        domain_interest: 'Technology & Consultancy',
        preferred_joining_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duration: '3 Months',
        duration_other: '',
        dob: '2000-01-01',
        gender: 'Male',
        nationality: 'Indian',
        id_type: 'Aadhaar',
        id_number_masked: '',
        id_number_encrypted: '',
        blood_group: '',
        permanent_address: '',
        current_address: '',
        skills: '',
        tools_platforms: '',
        academic_details: [],
        projects: [],
        experiences: [],
        emergency_contacts: [],
        bank_details: null,
        documents: [],
        status: 'Draft',
        declaration_accepted: false,
        declaration_timestamp: null,
        applicant_signature_name: '',
        submission_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      store.applications.push(app);
      this.writeLocalStore(store);

      await this.recordHistory(app.id, {
        userId: cleanEmail,
        userRole: 'Applicant',
        action: 'Application Initialized',
        previousStatus: null,
        newStatus: 'Draft',
        remarks: `Applicant started onboarding for ${position}`
      });

      // Try inserting into Supabase
      const sb = supabase.getSupabaseClient();
      if (sb) {
        try {
          await sb.from('onboarding_applications').insert([{
            id: app.id,
            application_id: app.application_id,
            access_token: app.access_token,
            applicant_email: app.applicant_email,
            applicant_name: app.applicant_name,
            applicant_phone: app.applicant_phone,
            position_applied: app.position_applied,
            domain_interest: app.domain_interest,
            preferred_joining_date: app.preferred_joining_date,
            duration: app.duration,
            dob: app.dob,
            gender: app.gender,
            nationality: app.nationality,
            permanent_address: app.permanent_address,
            current_address: app.current_address,
            status: app.status
          }]);
        } catch (e) {}
      }
    }

    return this.sanitizeApplicationForApplicant(app);
  }

  async getApplication(idOrAppIdOrToken, includeSensitive = false) {
    const store = this.readLocalStore();
    const cleanQuery = String(idOrAppIdOrToken || '').trim().toLowerCase();
    const app = store.applications.find(a => 
      a.id === idOrAppIdOrToken || 
      a.application_id === idOrAppIdOrToken || 
      a.access_token === idOrAppIdOrToken ||
      (a.applicant_email && a.applicant_email.toLowerCase() === cleanQuery) ||
      (a.application_id && a.application_id.toLowerCase() === cleanQuery)
    );

    if (!app) return null;

    if (includeSensitive) {
      const cloned = JSON.parse(JSON.stringify(app));
      if (cloned.id_number_encrypted) {
        cloned.id_number_raw = this.decryptValue(cloned.id_number_encrypted);
      }
      if (cloned.bank_details && cloned.bank_details.account_number_encrypted) {
        cloned.bank_details.account_number_raw = this.decryptValue(cloned.bank_details.account_number_encrypted);
      }
      return cloned;
    }

    return this.sanitizeApplicationForApplicant(app);
  }

  sanitizeApplicationForApplicant(app) {
    if (!app) return null;
    const cloned = JSON.parse(JSON.stringify(app));
    delete cloned.id_number_encrypted;
    if (cloned.bank_details) {
      delete cloned.bank_details.account_number_encrypted;
    }
    return cloned;
  }

  async saveStep(applicationId, stepNumber, payload) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (app.status === 'Submitted' || app.status === 'Approved' || app.status === 'Under HR Review' || app.status === 'Documents Under Verification') {
      if (app.status !== 'Correction Required') {
        throw new Error('Application is already submitted and cannot be modified without HR correction request.');
      }
    }

    const step = parseInt(stepNumber, 10);
    switch (step) {
      case 1: // Position Details
        if (payload.position_applied) app.position_applied = payload.position_applied;
        if (payload.position_other !== undefined) app.position_other = payload.position_other;
        if (payload.domain_interest) app.domain_interest = payload.domain_interest;
        if (payload.preferred_joining_date) app.preferred_joining_date = payload.preferred_joining_date;
        if (payload.duration) app.duration = payload.duration;
        if (payload.duration_other !== undefined) app.duration_other = payload.duration_other;
        break;

      case 2: // Personal Information
        if (payload.full_name) app.applicant_name = payload.full_name;
        if (payload.dob) app.dob = payload.dob;
        if (payload.gender) app.gender = payload.gender;
        if (payload.nationality) app.nationality = payload.nationality;
        if (payload.blood_group !== undefined) app.blood_group = payload.blood_group;
        if (payload.id_type) app.id_type = payload.id_type;
        if (payload.id_number) {
          app.id_number_masked = this.maskIdNumber(payload.id_number);
          app.id_number_encrypted = this.encryptValue(payload.id_number);
        }
        break;

      case 3: // Contact & Address Details
        if (payload.permanent_address) app.permanent_address = payload.permanent_address;
        if (payload.current_address) app.current_address = payload.current_address;
        const phone = payload.mobile_number || payload.applicant_phone || payload.phone;
        if (phone) app.applicant_phone = phone;
        const email = payload.personal_email || payload.applicant_email || payload.email;
        if (email) app.applicant_email = email.toLowerCase().trim();
        break;

      case 4: // Academic Information
        const acList = payload.academic_details || payload.academics;
        if (Array.isArray(acList)) {
          app.academic_details = acList.map(q => ({
            id: q.id || crypto.randomUUID(),
            qualification_type: q.qualification_type || 'UG',
            degree_name: q.degree_name || '',
            institution: q.institution || '',
            year_of_passing: parseInt(q.year_of_passing, 10) || new Date().getFullYear(),
            score_cgpa: q.score_cgpa || ''
          }));
        }
        break;

      case 5: // Skills & Experience
        if (payload.skills !== undefined) app.skills = payload.skills;
        if (payload.tools_platforms !== undefined) app.tools_platforms = payload.tools_platforms;
        const projList = payload.projects || payload.projects_experiences;
        if (Array.isArray(projList)) {
          app.projects = projList.map(p => ({
            id: p.id || crypto.randomUUID(),
            title: p.title || '',
            technologies: p.technologies || p.role_technologies || '',
            description: p.description || ''
          }));
        }
        if (Array.isArray(payload.experiences)) {
          app.experiences = payload.experiences.map(e => ({
            id: e.id || crypto.randomUUID(),
            organization: e.organization || '',
            role: e.role || '',
            duration: e.duration || '',
            description: e.description || ''
          }));
        }
        break;

      case 6: // Emergency Contact
        if (payload.emergency_contacts && Array.isArray(payload.emergency_contacts)) {
          app.emergency_contacts = payload.emergency_contacts;
        } else if (payload.contact_person) {
          app.emergency_contacts = [{
            id: crypto.randomUUID(),
            contact_person: payload.contact_person,
            relationship: payload.relationship || 'Parent',
            mobile_number: payload.mobile_number || '',
            alternate_number: payload.alternate_number || ''
          }];
        }
        break;

      case 7: // Bank Details
        if (payload.account_holder_name && payload.account_number && payload.ifsc_code) {
          const isMaskedInput = String(payload.account_number).includes('X');
          if (isMaskedInput && app.bank_details && app.bank_details.account_number_encrypted) {
            app.bank_details.account_holder_name = payload.account_holder_name;
            app.bank_details.bank_name = payload.bank_name || app.bank_details.bank_name || 'N/A';
            app.bank_details.ifsc_code = payload.ifsc_code.toUpperCase().trim();
          } else {
            app.bank_details = {
              account_holder_name: payload.account_holder_name,
              bank_name: payload.bank_name || 'N/A',
              account_number_masked: this.maskAccountNumber(payload.account_number),
              account_number_encrypted: this.encryptValue(payload.account_number),
              ifsc_code: payload.ifsc_code.toUpperCase().trim()
            };
          }
        }
        break;

      default:
        break;
    }

    app.updated_at = new Date().toISOString();
    this.writeLocalStore(store);

    return this.sanitizeApplicationForApplicant(app);
  }

  async attachDocument(applicationId, { category, originalFilename, filename, mimeType, sizeBytes, buffer = null }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    const relativePath = path.join(UPLOADS_DIR, filename);
    if (buffer) {
      try {
        fs.writeFileSync(relativePath, buffer);
      } catch (e) {}
    }

    // Remove existing document in same category if present
    app.documents = (app.documents || []).filter(d => d.category !== category);

    const docObj = {
      id: crypto.randomUUID(),
      category,
      original_filename: originalFilename,
      storage_path: filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      verification_status: 'Pending',
      hr_remarks: '',
      verified_by: null,
      verified_at: null,
      uploaded_at: new Date().toISOString()
    };

    app.documents.push(docObj);
    app.updated_at = new Date().toISOString();
    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: app.applicant_email,
      userRole: 'Applicant',
      action: 'Document Uploaded',
      previousStatus: app.status,
      newStatus: app.status,
      remarks: `Uploaded ${category} (${originalFilename})`
    });

    return docObj;
  }

  async deleteDocument(applicationId, docId) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (app.status === 'Submitted' || app.status === 'Approved') {
      throw new Error('Cannot delete document after final submission.');
    }

    const docIndex = (app.documents || []).findIndex(d => d.id === docId || d.category === docId);
    if (docIndex !== -1) {
      const removed = app.documents.splice(docIndex, 1)[0];
      this.writeLocalStore(store);
      return removed;
    }

    return null;
  }

  async submitApplication(applicationId, { declarationAccepted, signatureName }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (!declarationAccepted) {
      throw new Error('You must accept the declaration and code of conduct before submitting.');
    }
    if (!signatureName || signatureName.trim().length < 2) {
      throw new Error('Please enter your full legal name as your digital confirmation signature.');
    }

    // Mandatory document check
    const mandatoryCategories = ['resume', 'govt_id', 'academic_marksheets', 'passport_photo'];
    const uploadedCategories = (app.documents || []).map(d => d.category);
    const missingDocs = mandatoryCategories.filter(c => !uploadedCategories.includes(c));

    if (missingDocs.length > 0) {
      throw new Error(`Mandatory documents missing: ${missingDocs.join(', ')}. Please upload all mandatory documents.`);
    }

    // Mandatory fields check
    if (!app.applicant_name || !app.applicant_phone || !app.permanent_address || !app.dob) {
      throw new Error('Please ensure all required personal, contact, and address fields are filled.');
    }

    const prevStatus = app.status;
    app.status = 'Submitted';
    app.submission_date = new Date().toISOString();
    app.declaration_accepted = true;
    app.declaration_timestamp = new Date().toISOString();
    app.applicant_signature_name = signatureName.trim();
    app.updated_at = new Date().toISOString();

    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: app.applicant_email,
      userRole: 'Applicant',
      action: 'Application Submitted',
      previousStatus: prevStatus,
      newStatus: 'Submitted',
      remarks: `Submitted application with digital confirmation by ${signatureName}`
    });

    await this.sendNotification({
      recipientType: 'applicant',
      recipientEmail: app.applicant_email,
      applicationId: app.id,
      title: 'Application Successfully Submitted',
      message: `Your onboarding application (${app.application_id}) for ${app.position_applied} has been submitted to PUVIMA HR Operations for review.`,
      type: 'success'
    });

    await this.sendNotification({
      recipientType: 'hr',
      recipientEmail: null,
      applicationId: app.id,
      title: 'New Onboarding Application Submitted',
      message: `${app.applicant_name} submitted an onboarding application for ${app.position_applied} (${app.application_id}).`,
      type: 'info'
    });

    return this.sanitizeApplicationForApplicant(app);
  }

  async resubmitCorrections(applicationId, { changesSummary = '' }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (app.status !== 'Correction Required') {
      throw new Error('Application is not currently in Correction Required state.');
    }

    const prevStatus = app.status;
    app.status = 'Resubmitted';
    app.updated_at = new Date().toISOString();

    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: app.applicant_email,
      userRole: 'Applicant',
      action: 'Applicant Resubmitted',
      previousStatus: prevStatus,
      newStatus: 'Resubmitted',
      remarks: changesSummary || 'Applicant addressed requested corrections and resubmitted'
    });

    await this.sendNotification({
      recipientType: 'hr',
      recipientEmail: null,
      applicationId: app.id,
      title: 'Applicant Resubmitted Corrections',
      message: `${app.applicant_name} (${app.application_id}) has resubmitted updated details/documents.`,
      type: 'info'
    });

    return this.sanitizeApplicationForApplicant(app);
  }

  // --- HR MANAGEMENT & VERIFICATION WORKFLOW ---

  async getHrApplications({ search = '', position = '', status = '', page = 1, limit = 15 }) {
    const store = this.readLocalStore();
    let apps = store.applications || [];

    if (search) {
      const q = search.toLowerCase().trim();
      apps = apps.filter(a => 
        (a.applicant_name && a.applicant_name.toLowerCase().includes(q)) ||
        (a.application_id && a.application_id.toLowerCase().includes(q)) ||
        (a.applicant_email && a.applicant_email.toLowerCase().includes(q))
      );
    }

    if (position && position !== 'All') {
      apps = apps.filter(a => a.position_applied === position);
    }

    if (status && status !== 'All') {
      apps = apps.filter(a => a.status === status);
    }

    // Sort newest first
    apps.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const totalCount = apps.length;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));
    const paginated = apps.slice((p - 1) * l, p * l).map(a => this.sanitizeApplicationForApplicant(a));

    return {
      applications: paginated,
      totalCount,
      page: p,
      limit: l,
      totalPages: Math.ceil(totalCount / l) || 1
    };
  }

  async getHrStats() {
    const store = this.readLocalStore();
    const apps = store.applications || [];

    return {
      total: apps.length,
      newSubmissions: apps.filter(a => a.status === 'Submitted').length,
      underVerification: apps.filter(a => a.status === 'Under HR Review' || a.status === 'Documents Under Verification' || a.status === 'Resubmitted').length,
      correctionRequired: apps.filter(a => a.status === 'Correction Required').length,
      approved: apps.filter(a => a.status === 'Approved').length,
      rejected: apps.filter(a => a.status === 'Rejected').length
    };
  }

  async verifyDocument(applicationId, docId, { verificationStatus, hrRemarks = '', hrUser = 'HR Lead' }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    const doc = (app.documents || []).find(d => d.id === docId || d.category === docId);
    if (!doc) throw new Error('Document not found.');

    const validStatuses = ['Verified', 'Invalid', 'Missing', 'Correction Required', 'Pending'];
    if (!validStatuses.includes(verificationStatus)) {
      throw new Error(`Invalid status: ${verificationStatus}`);
    }

    const prevDocStatus = doc.verification_status;
    doc.verification_status = verificationStatus;
    doc.hr_remarks = hrRemarks;
    doc.verified_by = hrUser;
    doc.verified_at = new Date().toISOString();

    // If app is currently Submitted or Resubmitted, advance to Documents Under Verification
    if (app.status === 'Submitted' || app.status === 'Resubmitted' || app.status === 'Under HR Review') {
      app.status = 'Documents Under Verification';
    }

    app.updated_at = new Date().toISOString();
    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: hrUser,
      userRole: 'HR',
      action: `Document ${verificationStatus}`,
      previousStatus: prevDocStatus,
      newStatus: verificationStatus,
      remarks: `${doc.category}: ${hrRemarks || verificationStatus}`
    });

    return doc;
  }

  async requestCorrection(applicationId, { affectedFields = [], affectedDocuments = [], remarks, hrUser = 'HR Lead' }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (!remarks || remarks.trim().length < 5) {
      throw new Error('Please provide specific correction instructions for the applicant.');
    }

    const prevStatus = app.status;
    app.status = 'Correction Required';
    app.correction_request = {
      id: crypto.randomUUID(),
      requested_by: hrUser,
      requested_at: new Date().toISOString(),
      affected_fields: affectedFields,
      affected_documents: affectedDocuments,
      remarks: remarks.trim()
    };

    // Mark affected docs as Correction Required
    if (Array.isArray(affectedDocuments) && affectedDocuments.length > 0) {
      (app.documents || []).forEach(doc => {
        if (affectedDocuments.includes(doc.category) || affectedDocuments.includes(doc.id)) {
          doc.verification_status = 'Correction Required';
          doc.hr_remarks = remarks.trim();
        }
      });
    }

    app.updated_at = new Date().toISOString();
    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: hrUser,
      userRole: 'HR',
      action: 'Correction Requested',
      previousStatus: prevStatus,
      newStatus: 'Correction Required',
      remarks: remarks.trim()
    });

    await this.sendNotification({
      recipientType: 'applicant',
      recipientEmail: app.applicant_email,
      applicationId: app.id,
      title: 'Action Required: Application Correction Requested',
      message: `PUVIMA HR has reviewed your application (${app.application_id}) and requested updates: ${remarks.trim()}`,
      type: 'warning'
    });

    return this.sanitizeApplicationForApplicant(app);
  }

  async approveApplication(applicationId, { hrUser = 'HR Lead', hrNotes = '' }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    // Strict validation: Verify all mandatory documents are marked 'Verified'
    const mandatoryCategories = ['resume', 'govt_id', 'academic_marksheets', 'passport_photo'];
    const docs = app.documents || [];
    
    for (const cat of mandatoryCategories) {
      const doc = docs.find(d => d.category === cat);
      if (!doc) {
        throw new Error(`Cannot approve application: Mandatory document "${cat}" is missing.`);
      }
      if (doc.verification_status !== 'Verified') {
        throw new Error(`Cannot approve application: Document "${cat}" must be marked Verified (currently "${doc.verification_status}").`);
      }
    }

    const prevStatus = app.status;
    app.status = 'Approved';
    app.approved_by = hrUser;
    app.approved_at = new Date().toISOString();
    app.updated_at = new Date().toISOString();

    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: hrUser,
      userRole: 'HR',
      action: 'Application Approved',
      previousStatus: prevStatus,
      newStatus: 'Approved',
      remarks: hrNotes || 'All mandatory documents verified. Application approved.'
    });

    await this.sendNotification({
      recipientType: 'applicant',
      recipientEmail: app.applicant_email,
      applicationId: app.id,
      title: 'Congratulations! Your PUVIMA Onboarding is Approved',
      message: `Your onboarding application (${app.application_id}) for ${app.position_applied} has been fully verified and approved by PUVIMA HR Operations. Welcome to PUVIMA!`,
      type: 'success'
    });

    return this.sanitizeApplicationForApplicant(app);
  }

  async rejectApplication(applicationId, { rejectionReason, hrUser = 'HR Lead' }) {
    const store = this.readLocalStore();
    const app = store.applications.find(a => a.id === applicationId || a.application_id === applicationId);
    if (!app) throw new Error('Application not found.');

    if (!rejectionReason || rejectionReason.trim().length < 5) {
      throw new Error('A specific rejection reason is required.');
    }

    const prevStatus = app.status;
    app.status = 'Rejected';
    app.rejected_by = hrUser;
    app.rejected_at = new Date().toISOString();
    app.rejection_reason = rejectionReason.trim();
    app.updated_at = new Date().toISOString();

    this.writeLocalStore(store);

    await this.recordHistory(app.id, {
      userId: hrUser,
      userRole: 'HR',
      action: 'Application Rejected',
      previousStatus: prevStatus,
      newStatus: 'Rejected',
      remarks: rejectionReason.trim()
    });

    await this.sendNotification({
      recipientType: 'applicant',
      recipientEmail: app.applicant_email,
      applicationId: app.id,
      title: 'Update on Your PUVIMA Application',
      message: `Your application (${app.application_id}) for ${app.position_applied} could not be approved at this time: ${rejectionReason.trim()}`,
      type: 'alert'
    });

    return this.sanitizeApplicationForApplicant(app);
  }

  async getAuditHistory(applicationId) {
    const store = this.readLocalStore();
    const history = (store.history || []).filter(h => h.application_id === applicationId);
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return history;
  }
}

module.exports = new OnboardingService();

