/**
 * PUVIMA Consultancy — Careers & Recruitment Service
 * Handles persistence for job positions and candidate applications.
 * Executes parameterized queries against MySQL with resilient local JSON fallback.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { generateReferenceId, hashIp } = require('../utils/referenceId');
const { RESUMES_DIR } = require('../middleware/resumeUpload');
const emailService = require('./email.service');

const DATA_DIR = path.resolve(__dirname, '../../data');
const CAREERS_FILE = path.join(DATA_DIR, 'careers.json');

class CareersService {
  constructor() {
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CAREERS_FILE)) {
      const initial = {
        positions: [],
        applications: []
      };
      fs.writeFileSync(CAREERS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  readCareersFile() {
    this.ensureDataDir();
    try {
      const content = fs.readFileSync(CAREERS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('[CareersService] Error reading careers file:', e.message);
      return { positions: [], applications: [] };
    }
  }

  writeCareersFile(data) {
    this.ensureDataDir();
    try {
      fs.writeFileSync(CAREERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[CareersService] Error writing careers file:', e.message);
    }
  }

  // ==========================================================================
  // JOB POSITIONS (PUBLIC & ADMIN)
  // ==========================================================================

  /**
   * Get all published job positions for public display.
   */
  async getPublishedPositions({ department, search } = {}) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `SELECT * FROM job_positions WHERE status = 'published' ORDER BY created_at DESC`;
        const rows = await db.query(sql);
        if (Array.isArray(rows)) {
          let list = rows;
          if (department && department !== 'all') {
            list = list.filter(p => p.department && p.department.toLowerCase() === department.toLowerCase());
          }
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(p =>
              (p.title && p.title.toLowerCase().includes(q)) ||
              (p.department && p.department.toLowerCase().includes(q)) ||
              (p.description && p.description.toLowerCase().includes(q)) ||
              (p.required_skills && p.required_skills.toLowerCase().includes(q))
            );
          }
          return list;
        }
      }
    } catch (err) {
      // Graceful fallback to local file
    }

    // 2. Local fallback
    const store = this.readCareersFile();
    let list = store.positions.filter(p => p.status === 'published');
    if (department && department !== 'all') {
      list = list.filter(p => p.department && p.department.toLowerCase() === department.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.required_skills && p.required_skills.toLowerCase().includes(q))
      );
    }
    return list;
  }

  /**
   * Retrieve a single position by ID or Reference ID (for public application or detail).
   */
  async getPositionById(id, { allowUnpublished = false } = {}) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `SELECT * FROM job_positions WHERE id = ? OR reference_id = ? LIMIT 1`;
        const rows = await db.query(sql, [id, id]);
        if (Array.isArray(rows) && rows.length > 0) {
          const pos = rows[0];
          if (!allowUnpublished && pos.status !== 'published') {
            return null;
          }
          return pos;
        }
      }
    } catch (err) {}

    // 2. Local fallback
    const store = this.readCareersFile();
    const pos = store.positions.find(p => String(p.id) === String(id) || p.reference_id === id);
    if (!pos) return null;
    if (!allowUnpublished && pos.status !== 'published') return null;
    return pos;
  }

  /**
   * Get all positions for administrative management (including draft & closed).
   */
  async getAllPositionsAdmin({ status, department, search } = {}) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `SELECT * FROM job_positions ORDER BY created_at DESC`;
        const rows = await db.query(sql);
        if (Array.isArray(rows)) {
          let list = rows;
          if (status && status !== 'all') {
            list = list.filter(p => p.status === status);
          }
          if (department && department !== 'all') {
            list = list.filter(p => p.department && p.department.toLowerCase() === department.toLowerCase());
          }
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(p =>
              (p.title && p.title.toLowerCase().includes(q)) ||
              (p.reference_id && p.reference_id.toLowerCase().includes(q)) ||
              (p.department && p.department.toLowerCase().includes(q))
            );
          }
          return list;
        }
      }
    } catch (err) {}

    // 2. Local fallback
    const store = this.readCareersFile();
    let list = store.positions;
    if (status && status !== 'all') {
      list = list.filter(p => p.status === status);
    }
    if (department && department !== 'all') {
      list = list.filter(p => p.department && p.department.toLowerCase() === department.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.reference_id && p.reference_id.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q))
      );
    }
    return list;
  }

  /**
   * Create a new job position (Admin).
   */
  async createPosition(data) {
    const referenceId = generateReferenceId('JOB');
    const now = new Date().toISOString();

    const newPosition = {
      reference_id: referenceId,
      title: data.title.trim(),
      department: data.department.trim(),
      description: data.description.trim(),
      responsibilities: data.responsibilities ? data.responsibilities.trim() : null,
      required_skills: data.required_skills ? data.required_skills.trim() : null,
      employment_type: data.employment_type || 'Full-time',
      work_arrangement: data.work_arrangement || 'Hybrid',
      location: data.location || 'Chennai / Bangalore, India',
      experience_requirements: data.experience_requirements || 'Mid-Level',
      salary_range: data.salary_range || null,
      status: data.status || 'draft',
      application_deadline: data.application_deadline || null,
      created_at: now,
      updated_at: now
    };

    let dbSuccess = false;
    let insertedId = null;

    // 1. MySQL Execution
    try {
      const sql = `
        INSERT INTO job_positions (
          reference_id, title, department, description, responsibilities,
          required_skills, employment_type, work_arrangement, location,
          experience_requirements, salary_range, status, application_deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        newPosition.reference_id,
        newPosition.title,
        newPosition.department,
        newPosition.description,
        newPosition.responsibilities,
        newPosition.required_skills,
        newPosition.employment_type,
        newPosition.work_arrangement,
        newPosition.location,
        newPosition.experience_requirements,
        newPosition.salary_range,
        newPosition.status,
        newPosition.application_deadline
      ];
      const result = await db.query(sql, params);
      if (result && result.insertId) {
        insertedId = result.insertId;
        dbSuccess = true;
      }
    } catch (err) {
      // Handled via local storage
    }

    // 2. Dual-persistence in local file
    const store = this.readCareersFile();
    const localId = insertedId || (store.positions.length ? Math.max(...store.positions.map(p => p.id || 0)) + 1 : 1);
    const finalRecord = {
      id: localId,
      ...newPosition,
      persisted_in_db: dbSuccess
    };
    store.positions.unshift(finalRecord);
    this.writeCareersFile(store);

    return finalRecord;
  }

  /**
   * Update an existing position (Admin).
   */
  async updatePosition(id, data) {
    const now = new Date().toISOString();

    // 1. Update in local storage
    const store = this.readCareersFile();
    const position = store.positions.find(p => String(p.id) === String(id) || p.reference_id === id);
    if (position) {
      if (data.title !== undefined) position.title = data.title.trim();
      if (data.department !== undefined) position.department = data.department.trim();
      if (data.description !== undefined) position.description = data.description.trim();
      if (data.responsibilities !== undefined) position.responsibilities = data.responsibilities ? data.responsibilities.trim() : null;
      if (data.required_skills !== undefined) position.required_skills = data.required_skills ? data.required_skills.trim() : null;
      if (data.employment_type !== undefined) position.employment_type = data.employment_type;
      if (data.work_arrangement !== undefined) position.work_arrangement = data.work_arrangement;
      if (data.location !== undefined) position.location = data.location;
      if (data.experience_requirements !== undefined) position.experience_requirements = data.experience_requirements;
      if (data.salary_range !== undefined) position.salary_range = data.salary_range;
      if (data.status !== undefined) position.status = data.status;
      if (data.application_deadline !== undefined) position.application_deadline = data.application_deadline;
      position.updated_at = now;
      this.writeCareersFile(store);
    }

    // 2. Update in MySQL
    try {
      const sql = `
        UPDATE job_positions SET
          title = COALESCE(?, title),
          department = COALESCE(?, department),
          description = COALESCE(?, description),
          responsibilities = ?,
          required_skills = ?,
          employment_type = COALESCE(?, employment_type),
          work_arrangement = COALESCE(?, work_arrangement),
          location = COALESCE(?, location),
          experience_requirements = ?,
          salary_range = ?,
          status = COALESCE(?, status),
          application_deadline = ?
        WHERE id = ? OR reference_id = ?
      `;
      const params = [
        data.title || null,
        data.department || null,
        data.description || null,
        data.responsibilities !== undefined ? data.responsibilities : null,
        data.required_skills !== undefined ? data.required_skills : null,
        data.employment_type || null,
        data.work_arrangement || null,
        data.location || null,
        data.experience_requirements !== undefined ? data.experience_requirements : null,
        data.salary_range !== undefined ? data.salary_range : null,
        data.status || null,
        data.application_deadline !== undefined ? data.application_deadline : null,
        id,
        id
      ];
      await db.query(sql, params);
    } catch (err) {}

    return position;
  }

  /**
   * Update position status (publish, close, draft).
   */
  async updatePositionStatus(id, status) {
    return this.updatePosition(id, { status });
  }

  /**
   * Delete a position if no applications reference it.
   */
  async deletePosition(id) {
    const store = this.readCareersFile();
    // Check if applications exist for this position
    const hasApps = store.applications.some(a => String(a.job_position_id) === String(id) || a.job_reference_id === id);
    if (hasApps) {
      throw new Error('Cannot delete position with existing candidate applications. Close or archive the position instead.');
    }

    const idx = store.positions.findIndex(p => String(p.id) === String(id) || p.reference_id === id);
    if (idx !== -1) {
      store.positions.splice(idx, 1);
      this.writeCareersFile(store);
    }

    try {
      await db.query(`DELETE FROM job_positions WHERE id = ? OR reference_id = ?`, [id, id]);
    } catch (e) {}

    return true;
  }

  // ==========================================================================
  // CANDIDATE APPLICATIONS
  // ==========================================================================

  /**
   * Submit a new job application.
   * Persists application record durably BEFORE dispatching email notification.
   */
  async submitApplication(jobId, data, resumeData, clientIp = null) {
    // 1. Verify job position exists and is open
    const position = await this.getPositionById(jobId, { allowUnpublished: false });
    if (!position) {
      throw new Error('The selected position is no longer accepting applications or does not exist.');
    }

    const referenceId = generateReferenceId('APP');
    const ipHash = hashIp(clientIp);
    const now = new Date().toISOString();

    const applicationRecord = {
      reference_id: referenceId,
      job_position_id: position.id,
      job_reference_id: position.reference_id,
      job_title: position.title,
      job_department: position.department,
      applicant_name: data.applicant_name.trim(),
      applicant_email: data.applicant_email.trim().toLowerCase(),
      applicant_phone: data.applicant_phone.trim(),
      education: data.education ? data.education.trim() : null,
      skills: data.skills ? data.skills.trim() : null,
      experience_years: data.experience_years ? data.experience_years.trim() : null,
      linkedin_url: data.linkedin_url ? data.linkedin_url.trim() : null,
      portfolio_url: data.portfolio_url ? data.portfolio_url.trim() : null,
      cover_letter: data.cover_letter ? data.cover_letter.trim() : null,
      resume_filename: resumeData.originalName,
      resume_storage_key: resumeData.storageKey,
      resume_mime_type: resumeData.mimeType,
      resume_size_bytes: resumeData.sizeBytes,
      recruitment_status: 'received',
      admin_notes: '',
      notification_status: 'pending',
      ip_hash: ipHash,
      created_at: now,
      updated_at: now
    };

    let dbSuccess = false;
    let insertedAppId = null;

    // 2. Durably save in MySQL first
    try {
      const sql = `
        INSERT INTO job_applications (
          reference_id, job_position_id, applicant_name, applicant_email,
          applicant_phone, education, skills, experience_years,
          linkedin_url, portfolio_url, cover_letter,
          resume_filename, resume_storage_key, resume_mime_type, resume_size_bytes,
          recruitment_status, admin_notes, ip_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', '', ?)
      `;
      const params = [
        applicationRecord.reference_id,
        applicationRecord.job_position_id,
        applicationRecord.applicant_name,
        applicationRecord.applicant_email,
        applicationRecord.applicant_phone,
        applicationRecord.education,
        applicationRecord.skills,
        applicationRecord.experience_years,
        applicationRecord.linkedin_url,
        applicationRecord.portfolio_url,
        applicationRecord.cover_letter,
        applicationRecord.resume_filename,
        applicationRecord.resume_storage_key,
        applicationRecord.resume_mime_type,
        applicationRecord.resume_size_bytes,
        applicationRecord.ip_hash
      ];
      const result = await db.query(sql, params);
      if (result && result.insertId) {
        insertedAppId = result.insertId;
        dbSuccess = true;
      }
    } catch (err) {
      // Handled via local storage
    }

    // 3. Durably persist to local file for resilient dual-persistence
    const store = this.readCareersFile();
    const localId = insertedAppId || (store.applications.length ? Math.max(...store.applications.map(a => a.id || 0)) + 1 : 1);
    const savedRecord = {
      id: localId,
      ...applicationRecord,
      persisted_in_db: dbSuccess
    };
    store.applications.unshift(savedRecord);
    this.writeCareersFile(store);

    // 4. Send email notification ONLY AFTER durable persistence
    let emailResult = { delivered: false, note: 'Notification pending dispatch' };
    try {
      emailResult = await emailService.notifyJobApplication({
        application: savedRecord,
        position,
        resumePath: resumeData.absolutePath
      });
      savedRecord.notification_status = emailResult.delivered ? 'sent' : 'failed';
      this.writeCareersFile(store);
    } catch (e) {
      savedRecord.notification_status = 'failed';
      this.writeCareersFile(store);
      console.error('[CareersService] Email notification error:', e.message);
    }

    return {
      referenceId: savedRecord.reference_id,
      status: 'received',
      message: `Your application has been successfully submitted and recorded with reference ${savedRecord.reference_id}. Our talent acquisition team will review your qualifications.`,
      emailNotified: emailResult.delivered,
      emailNote: emailResult.note
    };
  }

  /**
   * Retrieve candidate applications for administrator view.
   */
  async getApplicationsAdmin({ jobId, status, search, limit = 50, offset = 0 } = {}) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `
          SELECT 
            a.*,
            p.title AS position_title,
            p.department AS position_department,
            p.reference_id AS position_reference_id
          FROM job_applications a
          LEFT JOIN job_positions p ON a.job_position_id = p.id
          ORDER BY a.created_at DESC
        `;
        const rows = await db.query(sql);
        if (Array.isArray(rows)) {
          let list = rows;
          if (jobId && jobId !== 'all') {
            list = list.filter(a => String(a.job_position_id) === String(jobId));
          }
          if (status && status !== 'all') {
            list = list.filter(a => a.recruitment_status === status);
          }
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(a =>
              (a.applicant_name && a.applicant_name.toLowerCase().includes(q)) ||
              (a.applicant_email && a.applicant_email.toLowerCase().includes(q)) ||
              (a.reference_id && a.reference_id.toLowerCase().includes(q)) ||
              (a.position_title && a.position_title.toLowerCase().includes(q)) ||
              (a.skills && a.skills.toLowerCase().includes(q))
            );
          }
          const total = list.length;
          const paginated = list.slice(offset, offset + limit);
          return { total, applications: paginated };
        }
      }
    } catch (err) {}

    // 2. Local fallback
    const store = this.readCareersFile();
    let list = store.applications;
    if (jobId && jobId !== 'all') {
      list = list.filter(a => String(a.job_position_id) === String(jobId) || a.job_reference_id === jobId);
    }
    if (status && status !== 'all') {
      list = list.filter(a => a.recruitment_status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.applicant_name && a.applicant_name.toLowerCase().includes(q)) ||
        (a.applicant_email && a.applicant_email.toLowerCase().includes(q)) ||
        (a.reference_id && a.reference_id.toLowerCase().includes(q)) ||
        (a.job_title && a.job_title.toLowerCase().includes(q)) ||
        (a.skills && a.skills.toLowerCase().includes(q))
      );
    }
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { total, applications: paginated };
  }

  /**
   * Retrieve single application detail (Admin).
   */
  async getApplicationByIdAdmin(id) {
    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `
          SELECT 
            a.*,
            p.title AS position_title,
            p.department AS position_department,
            p.reference_id AS position_reference_id
          FROM job_applications a
          LEFT JOIN job_positions p ON a.job_position_id = p.id
          WHERE a.id = ? OR a.reference_id = ?
          LIMIT 1
        `;
        const rows = await db.query(sql, [id, id]);
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      }
    } catch (err) {}

    // 2. Local fallback
    const store = this.readCareersFile();
    const app = store.applications.find(a => String(a.id) === String(id) || a.reference_id === id);
    return app || null;
  }

  /**
   * Update recruitment status and admin notes (Admin).
   */
  async updateApplicationStatus(id, { status, admin_notes }) {
    const validStatuses = ['received', 'under_review', 'shortlisted', 'interview', 'selected', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      throw new Error(`Invalid recruitment status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const now = new Date().toISOString();

    // 1. Update in local file
    const store = this.readCareersFile();
    const application = store.applications.find(a => String(a.id) === String(id) || a.reference_id === id);
    if (application) {
      if (status) application.recruitment_status = status;
      if (admin_notes !== undefined) application.admin_notes = admin_notes;
      application.updated_at = now;
      this.writeCareersFile(store);
    }

    // 2. Update in MySQL
    try {
      const sql = `
        UPDATE job_applications SET
          recruitment_status = COALESCE(?, recruitment_status),
          admin_notes = COALESCE(?, admin_notes)
        WHERE id = ? OR reference_id = ?
      `;
      await db.query(sql, [status || null, admin_notes !== undefined ? admin_notes : null, id, id]);
    } catch (err) {}

    return application;
  }

  /**
   * Safely resolve the absolute file path for an applicant's resume.
   * Enforces strict path traversal prevention.
   */
  async getApplicationResumePath(id) {
    const application = await this.getApplicationByIdAdmin(id);
    if (!application || !application.resume_storage_key) {
      return null;
    }

    const safeBase = path.resolve(RESUMES_DIR);
    const sanitizedKey = path.basename(application.resume_storage_key);
    const resolvedPath = path.resolve(RESUMES_DIR, sanitizedKey);

    // Strict path traversal check
    if (!resolvedPath.startsWith(safeBase)) {
      throw new Error('Access denied: Malformed resume storage path.');
    }

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    return {
      filePath: resolvedPath,
      filename: application.resume_filename || 'Candidate_Resume.pdf',
      mimeType: application.resume_mime_type || 'application/pdf'
    };
  }
}

module.exports = new CareersService();
