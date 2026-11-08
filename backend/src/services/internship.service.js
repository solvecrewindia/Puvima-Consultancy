/**
 * PUVIMA Consultancy — Internship Application Service
 * Manages full lifecycle of candidate internship applications:
 * validation, secure resume storage, MySQL persistence with JSON fallback,
 * HR & Super Admin review tracking, and immutable audit history.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/database');
const googleDriveService = require('./googleDrive.service');
const { validateMagicBytes, MAX_UPLOAD_BYTES } = require('../middleware/resumeUpload');

const DATA_FILE_DIR = path.resolve(__dirname, '../../../data');
const BACKEND_DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_FILE_DIR, 'internship-applications.json');
const BACKEND_DATA_FILE = path.join(BACKEND_DATA_DIR, 'internship-applications.json');
const HISTORY_FILE = path.join(DATA_FILE_DIR, 'internship-application-history.json');
const BACKEND_HISTORY_FILE = path.join(BACKEND_DATA_DIR, 'internship-application-history.json');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9()\-\s.]{7,30}$/;

const VALID_STUDY_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate',
  'Recent Graduate'
];

const VALID_CGPA_RANGES = [
  'Below 6.0 CGPA / Below 60%',
  '6.0–6.9 CGPA / 60–69%',
  '7.0–7.9 CGPA / 70–79%',
  '8.0–8.9 CGPA / 80–89%',
  '9.0–10 CGPA / 90% or above',
  'Not applicable / Prefer not to disclose'
];

const VALID_INTERNSHIP_ROLES = [
  'Software Development',
  'Artificial Intelligence / Machine Learning',
  'Data Analytics / Data Science',
  'Web Development',
  'Mobile App Development',
  'UI/UX Design',
  'Cybersecurity',
  'Marketing / Content',
  'Sales / Business Development',
  'Operations / Business',
  'Robotics',
  'Blockchain',
  'Other'
];

const VALID_MODES = ['Remote', 'On-site', 'Hybrid', 'Flexible'];

const VALID_DURATIONS = [
  '1 month',
  '2–3 months',
  '3–6 months',
  '6 months or more',
  'Flexible'
];

const VALID_AVAILABILITY = [
  'Immediately',
  'Within 2 weeks',
  'Within 1 month',
  'On a specific future date'
];

const VALID_HOURS = [
  'Under 10 hours',
  '10–20 hours',
  '20–30 hours',
  '30–40 hours',
  'Full-time / Flexible'
];

const VALID_REFERRALS = [
  'LinkedIn',
  'Instagram / Other Social Media',
  'College Placement Cell',
  'College / Campus Event',
  'Friend / Referral',
  'Company Website',
  'Job Portal',
  'Faculty Member',
  'Other'
];

// The 6 canonical statuses required across HR and Super Admin portals
const CANONICAL_STATUSES = [
  'New',
  'Under Review',
  'Shortlisted',
  'Interview',
  'Selected',
  'Rejected'
];

function normalizeStatus(status) {
  if (!status) return null;
  const s = String(status).trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (s === 'new' || s === 'received') return 'New';
  if (s === 'under review') return 'Under Review';
  if (s === 'shortlisted') return 'Shortlisted';
  if (s === 'interview') return 'Interview';
  if (s === 'selected' || s === 'accepted' || s === 'accept') return 'Selected';
  if (s === 'rejected' || s === 'reject') return 'Rejected';
  if (s === 'archived') return 'Archived';
  return null;
}

class InternshipService {
  constructor() {
    this.ensureDataFiles();
  }

  ensureDataFiles() {
    try {
      if (!fs.existsSync(DATA_FILE_DIR)) fs.mkdirSync(DATA_FILE_DIR, { recursive: true });
      if (!fs.existsSync(BACKEND_DATA_DIR)) fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });

      if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ applications: [] }, null, 2));
      }
      if (!fs.existsSync(BACKEND_DATA_FILE)) {
        fs.writeFileSync(BACKEND_DATA_FILE, JSON.stringify({ applications: [] }, null, 2));
      }

      if (!fs.existsSync(HISTORY_FILE)) {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history: [] }, null, 2));
      }
      if (!fs.existsSync(BACKEND_HISTORY_FILE)) {
        fs.writeFileSync(BACKEND_HISTORY_FILE, JSON.stringify({ history: [] }, null, 2));
      }
    } catch (err) {
      // Graceful in read-only serverless hosts
    }
  }

  readLocalApplications() {
    try {
      const fileToRead = fs.existsSync(DATA_FILE) ? DATA_FILE : (fs.existsSync(BACKEND_DATA_FILE) ? BACKEND_DATA_FILE : null);
      if (fileToRead) {
        const raw = fs.readFileSync(fileToRead, 'utf8');
        const parsed = JSON.parse(raw);
        const apps = Array.isArray(parsed) ? parsed : (parsed.applications || []);
        // Normalize statuses in existing data
        return apps.map((a) => ({
          ...a,
          recruitment_status: normalizeStatus(a.recruitment_status) || 'New',
          is_reviewed_by_hr: a.is_reviewed_by_hr !== undefined ? (a.is_reviewed_by_hr ? 1 : 0) : 0
        }));
      }
    } catch (err) {
      console.warn('[InternshipService] Error reading local JSON fallback:', err.message);
    }
    return [];
  }

  writeLocalApplications(applications) {
    try {
      const payload = JSON.stringify({ applications }, null, 2);
      if (fs.existsSync(DATA_FILE_DIR)) fs.writeFileSync(DATA_FILE, payload);
      if (fs.existsSync(BACKEND_DATA_DIR)) fs.writeFileSync(BACKEND_DATA_FILE, payload);
      return true;
    } catch (err) {
      console.warn('[InternshipService] Error writing local JSON fallback:', err.message);
      return false;
    }
  }

  readLocalHistory() {
    try {
      const fileToRead = fs.existsSync(HISTORY_FILE) ? HISTORY_FILE : (fs.existsSync(BACKEND_HISTORY_FILE) ? BACKEND_HISTORY_FILE : null);
      if (fileToRead) {
        const raw = fs.readFileSync(fileToRead, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed.history || []);
      }
    } catch (err) {
      console.warn('[InternshipService] Error reading local history JSON:', err.message);
    }
    return [];
  }

  writeLocalHistory(history) {
    try {
      const payload = JSON.stringify({ history }, null, 2);
      if (fs.existsSync(DATA_FILE_DIR)) fs.writeFileSync(HISTORY_FILE, payload);
      if (fs.existsSync(BACKEND_DATA_DIR)) fs.writeFileSync(BACKEND_HISTORY_FILE, payload);
      return true;
    } catch (err) {
      console.warn('[InternshipService] Error writing local history JSON:', err.message);
      return false;
    }
  }

  generateReferenceId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PUV-INT-${dateStr}-${randomHex}`;
  }

  /**
   * Validate all 5 sections of candidate application data
   * @param {Object} data 
   * @param {Object} file - req.file from multer
   * @returns {{ isValid: boolean, errors: Object, sanitized: Object }}
   */
  validateApplication(data, file) {
    const errors = {};
    const sanitized = {};

    // ------------------------------------------------------------------------
    // SECTION 01: Personal & Academic Information
    // ------------------------------------------------------------------------
    const fullName = (data.full_name || data.name || '').trim();
    if (!fullName || fullName.length < 2) {
      errors.full_name = 'Full legal name is required (minimum 2 characters).';
    } else if (fullName.length > 128) {
      errors.full_name = 'Full name must not exceed 128 characters.';
    }
    sanitized.full_name = fullName;

    const email = (data.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      errors.email = 'A valid email address is required.';
    } else if (email.length > 255) {
      errors.email = 'Email address is too long.';
    }
    sanitized.email = email;

    const phone = (data.phone || '').trim();
    if (!phone || !PHONE_REGEX.test(phone)) {
      errors.phone = 'A valid mobile number with country code is required (e.g. +91 98765 43210).';
    }
    sanitized.phone = phone;

    const cityState = (data.city_state || data.location || '').trim();
    if (!cityState || cityState.length < 2) {
      errors.city_state = 'City and State are required.';
    }
    sanitized.city_state = cityState;

    const linkedinUrl = (data.linkedin_url || data.linkedin || '').trim();
    if (linkedinUrl && !linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
      errors.linkedin_url = 'LinkedIn URL must start with http:// or https://';
    }
    sanitized.linkedin_url = linkedinUrl || null;

    const college = (data.college || data.university || '').trim();
    if (!college || college.length < 2) {
      errors.college = 'College or University name is required.';
    }
    sanitized.college = college;

    const degree = (data.degree || data.specialization || '').trim();
    if (!degree || degree.length < 2) {
      errors.degree = 'Degree and Specialization are required (e.g. B.Tech Computer Science).';
    }
    sanitized.degree = degree;

    const studyYear = (data.study_year || data.year_of_study || '').trim();
    if (!studyYear || !VALID_STUDY_YEARS.includes(studyYear)) {
      errors.study_year = `Current year of study must be one of: ${VALID_STUDY_YEARS.join(', ')}.`;
    }
    sanitized.study_year = studyYear;

    const graduationYear = (data.graduation_year || data.expected_graduation || '').toString().trim();
    if (!graduationYear || !/^\d{4}$/.test(graduationYear)) {
      errors.graduation_year = 'Expected graduation year is required (4-digit year, e.g. 2026).';
    }
    sanitized.graduation_year = graduationYear;

    const cgpaRange = (data.cgpa_range || data.cgpa || '').trim();
    if (!cgpaRange || !VALID_CGPA_RANGES.includes(cgpaRange)) {
      errors.cgpa_range = 'Current CGPA or percentage range is required.';
    }
    sanitized.cgpa_range = cgpaRange;

    // ------------------------------------------------------------------------
    // SECTION 02: Internship Role & Skills
    // ------------------------------------------------------------------------
    const internshipRole = (data.internship_role || data.role || '').trim();
    if (!internshipRole || !VALID_INTERNSHIP_ROLES.includes(internshipRole)) {
      errors.internship_role = `Internship role must be selected from the approved list.`;
    }
    sanitized.internship_role = internshipRole;

    // Parse skills (can be array or JSON string)
    let skillsList = [];
    if (Array.isArray(data.skills)) {
      skillsList = data.skills;
    } else if (typeof data.skills === 'string') {
      try {
        const parsed = JSON.parse(data.skills);
        if (Array.isArray(parsed)) skillsList = parsed;
        else skillsList = [data.skills];
      } catch (e) {
        skillsList = data.skills.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (!skillsList || skillsList.length === 0) {
      errors.skills = 'Please select at least one skill or technology.';
    }
    sanitized.skills = skillsList;

    const strongestSkills = (data.strongest_skills || '').trim();
    if (!strongestSkills || strongestSkills.length < 10) {
      errors.strongest_skills = 'Please describe your strongest skills (minimum 10 characters).';
    }
    sanitized.strongest_skills = strongestSkills;

    const projectsExp = (data.projects_experience || data.projects || '').trim();
    sanitized.projects_experience = projectsExp || null;

    const githubUrl = (data.github_portfolio_url || data.portfolio_url || data.github || '').trim();
    if (githubUrl && !githubUrl.startsWith('http://') && !githubUrl.startsWith('https://')) {
      errors.github_portfolio_url = 'Portfolio / GitHub URL must start with http:// or https://';
    }
    sanitized.github_portfolio_url = githubUrl || null;

    // ------------------------------------------------------------------------
    // RESUME FILE UPLOAD VALIDATION
    // ------------------------------------------------------------------------
    if (!file) {
      errors.resume = 'A resume file (PDF, DOC, or DOCX) is required.';
    } else {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const allowedExts = ['.pdf', '.doc', '.docx'];
      if (!allowedExts.includes(ext)) {
        errors.resume = 'Unsupported file format. Only PDF (.pdf), Word (.doc), and Word OpenXML (.docx) files are accepted.';
      } else if (file.size > MAX_UPLOAD_BYTES) {
        errors.resume = `Resume file size exceeds the 5MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
      } else if (!validateMagicBytes(file.buffer, ext)) {
        errors.resume = 'The file contents do not match its declared document format. Executables and corrupted files are strictly rejected.';
      }
    }

    // ------------------------------------------------------------------------
    // SECTION 03: Motivation & Availability
    // ------------------------------------------------------------------------
    const motivation = (data.motivation || '').trim();
    if (!motivation || motivation.length < 10) {
      errors.motivation = 'Please share why you would like to join our company as an intern (minimum 10 characters).';
    }
    sanitized.motivation = motivation;

    const contribution = (data.expected_contribution || data.contribution || '').trim();
    if (!contribution || contribution.length < 10) {
      errors.expected_contribution = 'Please explain what you would bring to our team (minimum 10 characters).';
    }
    sanitized.expected_contribution = contribution;

    const mode = (data.internship_mode || '').trim();
    if (!mode || !VALID_MODES.includes(mode)) {
      errors.internship_mode = `Preferred internship mode must be one of: ${VALID_MODES.join(', ')}.`;
    }
    sanitized.internship_mode = mode;

    const duration = (data.duration || '').trim();
    if (!duration || !VALID_DURATIONS.includes(duration)) {
      errors.duration = `Preferred duration must be one of: ${VALID_DURATIONS.join(', ')}.`;
    }
    sanitized.duration = duration;

    const joining = (data.joining_availability || '').trim();
    if (!joining || !VALID_AVAILABILITY.includes(joining)) {
      errors.joining_availability = `Joining availability must be one of: ${VALID_AVAILABILITY.join(', ')}.`;
    }
    sanitized.joining_availability = joining;

    let specificDate = null;
    if (joining === 'On a specific future date') {
      const rawDate = (data.specific_joining_date || '').trim();
      if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        errors.specific_joining_date = 'Please select a valid future date (YYYY-MM-DD) for your start date.';
      } else {
        specificDate = rawDate;
      }
    }
    sanitized.specific_joining_date = specificDate;

    const weeklyHours = (data.weekly_hours || '').trim();
    if (!weeklyHours || !VALID_HOURS.includes(weeklyHours)) {
      errors.weekly_hours = `Hours available per week must be one of: ${VALID_HOURS.join(', ')}.`;
    }
    sanitized.weekly_hours = weeklyHours;

    // ------------------------------------------------------------------------
    // SECTION 04: Final Details
    // ------------------------------------------------------------------------
    const referral = (data.referral_source || '').trim();
    if (!referral || !VALID_REFERRALS.includes(referral)) {
      errors.referral_source = `How did you hear about us must be selected.`;
    }
    sanitized.referral_source = referral;

    let otherReferral = null;
    if (referral === 'Other') {
      otherReferral = (data.other_referral_details || '').trim();
      if (!otherReferral) {
        errors.other_referral_details = 'Please specify how you heard about us.';
      }
    }
    sanitized.other_referral_details = otherReferral;

    sanitized.additional_information = (data.additional_information || '').trim() || null;

    // ------------------------------------------------------------------------
    // SECTION 05: Compliance & Consent
    // ------------------------------------------------------------------------
    const consent = data.consent_given !== undefined ? data.consent_given : data.consent;
    if (consent !== true && consent !== 'true' && consent !== 1 && consent !== '1') {
      errors.consent = 'You must review and agree to the privacy and data processing terms to submit.';
    }
    sanitized.consent_given = 1;

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Submit complete internship application
   * Saves to MySQL & local JSON fallback, stores resume locally, tracks status as 'New',
   * and creates initial audit history record.
   * Completely removes automatic recruitment emails to HR / Super Admin.
   * @param {Object} rawFormData 
   * @param {Object} file - req.file from multer (in-memory)
   * @param {string} clientIp 
   * @returns {Promise<Object>}
   */
  /**
   * Check for an existing application by email or phone and enforce reapplication rules:
   * 1. If an application is active (New, Under Review, Shortlisted, Interview):
   *    Candidate cannot reapply ("pending in review").
   * 2. If an application was Selected/Accepted:
   *    Candidate cannot reapply.
   * 3. If an application was Rejected:
   *    Must wait 2 months (60 days) before reapplying ("after 2 months apply again").
   * @param {string} email
   * @param {string} phone
   * @returns {Promise<{ allowed: boolean, reason?: string, status?: string, reference_id?: string, eligibleDate?: string, daysRemaining?: number }>}
   */
  async checkReapplicationEligibility(email, phone) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const digits = (phone || '').replace(/\D/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

    if (!cleanEmail && !last10) {
      return { allowed: true };
    }

    let candidateApps = [];

    // 1. Check Supabase
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        if (cleanEmail) {
          const { data: byEmail } = await supabase
            .from('internship_applications')
            .select('*')
            .eq('email', cleanEmail)
            .order('created_at', { ascending: false });
          if (byEmail && byEmail.length > 0) {
            candidateApps.push(...byEmail);
          }
        }

        // Query by phone
        if (last10) {
          const { data: allRecent } = await supabase
            .from('internship_applications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
          if (allRecent && allRecent.length > 0) {
            for (const app of allRecent) {
              const appDigits = (app.phone || '').replace(/\D/g, '');
              const appLast10 = appDigits.length >= 10 ? appDigits.slice(-10) : appDigits;
              if (appLast10 && appLast10 === last10) {
                if (!candidateApps.some((c) => c.reference_id === app.reference_id)) {
                  candidateApps.push(app);
                }
              }
            }
          }
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Duplicate check Supabase error:', sbErr.message);
    }

    // 2. Check local JSON fallback
    const localApps = this.readLocalApplications();
    for (const app of localApps) {
      const appEmail = (app.email || '').trim().toLowerCase();
      const appDigits = (app.phone || '').replace(/\D/g, '');
      const appLast10 = appDigits.length >= 10 ? appDigits.slice(-10) : appDigits;

      const emailMatch = cleanEmail && appEmail === cleanEmail;
      const phoneMatch = last10 && appLast10 && last10 === appLast10;

      if (emailMatch || phoneMatch) {
        if (!candidateApps.some((c) => c.reference_id === app.reference_id)) {
          candidateApps.push(app);
        }
      }
    }

    if (candidateApps.length === 0) {
      return { allowed: true };
    }

    // Sort by latest decision/update date
    candidateApps.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const latestApp = candidateApps[0];
    const status = normalizeStatus(latestApp.recruitment_status) || 'New';

    // Rule 1: Pending / Active Application (New, Under Review, Shortlisted, Interview)
    if (status === 'New' || status === 'Under Review' || status === 'Shortlisted' || status === 'Interview') {
      return {
        allowed: false,
        status: 'Pending',
        reference_id: latestApp.reference_id,
        reason: `Your application is currently pending in review (Reference: ${latestApp.reference_id}). You cannot submit another application while your profile is under review.`
      };
    }

    // Rule 2: Selected / Accepted Application
    if (status === 'Selected') {
      return {
        allowed: false,
        status: 'Selected',
        reference_id: latestApp.reference_id,
        reason: `An application with this contact information has already been accepted (Reference: ${latestApp.reference_id}). Please check your email for official onboarding instructions.`
      };
    }

    // Rule 3: Rejected Application -> 2 months (60 days) cooldown
    if (status === 'Rejected') {
      const decisionDate = new Date(latestApp.updated_at || latestApp.hr_reviewed_at || latestApp.created_at || Date.now());
      const COOLDOWN_DAYS = 60;
      const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      const eligibleDate = new Date(decisionDate.getTime() + cooldownMs);
      const now = new Date();

      if (now < eligibleDate) {
        const msRemaining = eligibleDate.getTime() - now.getTime();
        const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
        const formattedEligible = eligibleDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedDecision = decisionDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return {
          allowed: false,
          status: 'Rejected',
          reference_id: latestApp.reference_id,
          rejectionDate: formattedDecision,
          eligibleDate: formattedEligible,
          daysRemaining,
          reason: `Your previous application was rejected on ${formattedDecision}. Candidates may apply again after 2 months (eligible on ${formattedEligible}, ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`
        };
      }
    }

    return { allowed: true };
  }

  async submitApplication(rawFormData, file, clientIp = '') {
    // 1. Validation
    const validation = this.validateApplication(rawFormData, file);
    if (!validation.isValid) {
      const err = new Error('Application validation failed.');
      err.errors = validation.errors;
      err.statusCode = 400;
      throw err;
    }

    const appData = validation.sanitized;

    // Duplicate application check & 2-month rejection cooldown
    const eligibility = await this.checkReapplicationEligibility(appData.email, appData.phone);
    if (!eligibility.allowed) {
      const err = new Error(eligibility.reason);
      err.statusCode = 409;
      err.eligibility = eligibility;
      throw err;
    }

    const referenceId = this.generateReferenceId();
    appData.reference_id = referenceId;

    // 2. Hash IP for privacy-preserving rate/abuse tracking
    if (clientIp) {
      appData.ip_hash = crypto.createHash('sha256').update(clientIp + 'puvima_salt_2026').digest('hex').slice(0, 32);
    }

    // 3. Prepare Resume Metadata & Local Storage
    const originalExt = path.extname(file.originalname).toLowerCase();
    let canonicalMime = file.mimetype;
    if (originalExt === '.pdf') canonicalMime = 'application/pdf';
    else if (originalExt === '.doc') canonicalMime = 'application/msword';
    else if (originalExt === '.docx') canonicalMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    appData.resume_filename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
    appData.resume_mime_type = canonicalMime;
    appData.resume_size_bytes = file.size;

    // Save resume locally in uploads/resumes
    const localResumesDir = process.env.VERCEL
      ? path.join(require('os').tmpdir(), 'puvima-resumes')
      : path.resolve(__dirname, '../../uploads/resumes');
    try {
      if (!fs.existsSync(localResumesDir)) fs.mkdirSync(localResumesDir, { recursive: true });
      const localKey = `resume_${referenceId}_${Date.now()}${originalExt}`;
      const localPath = path.join(localResumesDir, localKey);
      fs.writeFileSync(localPath, file.buffer);
      appData.resume_storage_key = localKey;
    } catch (fsErr) {
      console.warn('[InternshipService] Local resume storage warning:', fsErr.message);
    }

    // Supabase Resume Storage & Persistence
    appData.resume_supabase_path = null;
    appData.resume_supabase_url = null;
    appData.resume_drive_file_id = null;
    appData.resume_drive_url = null;

    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase && file.buffer) {
        const sanitizedName = (appData.resume_filename || 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `resumes/${referenceId}_${Date.now()}_${sanitizedName}`;

        // 1. Upload binary file into Supabase Storage 'resumes' bucket
        try {
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('resumes')
            .upload(storagePath, file.buffer, {
              contentType: canonicalMime,
              upsert: true
            });

          if (!uploadErr && uploadData) {
            appData.resume_supabase_path = storagePath;
            const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(storagePath);
            if (urlData && urlData.publicUrl) {
              appData.resume_supabase_url = urlData.publicUrl;
            }
          } else if (uploadErr) {
            console.warn('[InternshipService] Supabase Storage upload notice:', uploadErr.message);
          }
        } catch (storageErr) {
          console.warn('[InternshipService] Supabase Storage upload exception:', storageErr.message);
        }

        // 2. Also save resume document directly into Supabase table 'resume_documents'
        try {
          const fileBase64 = file.buffer.toString('base64');
          await supabase
            .from('resume_documents')
            .upsert({
              reference_id: referenceId,
              filename: appData.resume_filename,
              mime_type: canonicalMime,
              size_bytes: file.size,
              file_data_base64: fileBase64,
              storage_url: appData.resume_supabase_url || null
            });
        } catch (dbDocErr) {
          console.warn('[InternshipService] Supabase resume_documents table notice:', dbDocErr.message);
        }

        // 3. Sync full application record into Supabase 'internship_applications'
        try {
          await supabase
            .from('internship_applications')
            .upsert({
              reference_id: appData.reference_id,
              full_name: appData.full_name,
              email: appData.email,
              phone: appData.phone,
              city_state: appData.city_state,
              linkedin_url: appData.linkedin_url,
              college: appData.college,
              degree: appData.degree,
              study_year: appData.study_year,
              graduation_year: appData.graduation_year,
              cgpa_range: appData.cgpa_range,
              internship_role: appData.internship_role,
              skills: appData.skills,
              strongest_skills: appData.strongest_skills,
              projects_experience: appData.projects_experience,
              github_portfolio_url: appData.github_portfolio_url,
              resume_filename: appData.resume_filename,
              resume_mime_type: appData.resume_mime_type,
              resume_size_bytes: appData.resume_size_bytes,
              resume_storage_key: appData.resume_storage_key,
              resume_supabase_url: appData.resume_supabase_url,
              resume_supabase_path: appData.resume_supabase_path,
              motivation: appData.motivation,
              expected_contribution: appData.expected_contribution,
              internship_mode: appData.internship_mode,
              duration: appData.duration,
              joining_availability: appData.joining_availability,
              specific_joining_date: appData.specific_joining_date,
              weekly_hours: appData.weekly_hours,
              referral_source: appData.referral_source,
              other_referral_details: appData.other_referral_details,
              additional_information: appData.additional_information,
              recruitment_status: 'New',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        } catch (sbAppErr) {
          console.warn('[InternshipService] Supabase internship_applications table notice:', sbAppErr.message);
        }
      }
    } catch (sbTotalErr) {
      console.warn('[InternshipService] Supabase overall persistence notice:', sbTotalErr.message);
    }

    // Google Drive fallback if configured
    if (googleDriveService.isConfigured()) {
      try {
        const driveResult = await googleDriveService.uploadResume({
          buffer: file.buffer,
          originalName: appData.resume_filename,
          mimeType: canonicalMime,
          referenceId
        });
        appData.resume_drive_file_id = driveResult.fileId;
        appData.resume_drive_url = driveResult.webViewLink;
      } catch (driveErr) {
        console.warn('[InternshipService] Optional Google Drive upload skipped/failed:', driveErr.message);
      }
    }

    // Status defaults to 'New' upon submission
    appData.recruitment_status = 'New';
    appData.is_reviewed_by_hr = 0;
    appData.hr_reviewed_at = null;
    appData.hr_reviewed_by = null;
    appData.email_notification_status = 'disabled'; // Emails removed as required
    appData.created_at = new Date().toISOString();
    appData.updated_at = appData.created_at;

    // 4. Durably save into MySQL (with graceful local JSON fallback)
    let savedInDb = false;
    let savedId = null;

    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        // Ensure table exists with new columns
        await db.query(`
          CREATE TABLE IF NOT EXISTS \`internship_applications\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            \`reference_id\` VARCHAR(64) NOT NULL,
            \`full_name\` VARCHAR(128) NOT NULL,
            \`email\` VARCHAR(255) NOT NULL,
            \`phone\` VARCHAR(64) NOT NULL,
            \`city_state\` VARCHAR(128) NOT NULL,
            \`linkedin_url\` VARCHAR(255) DEFAULT NULL,
            \`college\` VARCHAR(255) NOT NULL,
            \`degree\` VARCHAR(255) NOT NULL,
            \`study_year\` VARCHAR(64) NOT NULL,
            \`graduation_year\` VARCHAR(16) NOT NULL,
            \`cgpa_range\` VARCHAR(64) NOT NULL,
            \`internship_role\` VARCHAR(128) NOT NULL,
            \`skills\` JSON DEFAULT NULL,
            \`strongest_skills\` TEXT NOT NULL,
            \`projects_experience\` TEXT DEFAULT NULL,
            \`github_portfolio_url\` VARCHAR(255) DEFAULT NULL,
            \`resume_filename\` VARCHAR(255) NOT NULL,
            \`resume_drive_file_id\` VARCHAR(255) DEFAULT NULL,
            \`resume_drive_url\` VARCHAR(512) DEFAULT NULL,
            \`resume_storage_key\` VARCHAR(255) DEFAULT NULL,
            \`resume_mime_type\` VARCHAR(128) NOT NULL,
            \`resume_size_bytes\` INT UNSIGNED NOT NULL,
            \`motivation\` TEXT NOT NULL,
            \`expected_contribution\` TEXT NOT NULL,
            \`internship_mode\` VARCHAR(64) NOT NULL,
            \`duration\` VARCHAR(64) NOT NULL,
            \`joining_availability\` VARCHAR(64) NOT NULL,
            \`specific_joining_date\` DATE DEFAULT NULL,
            \`weekly_hours\` VARCHAR(64) NOT NULL,
            \`referral_source\` VARCHAR(128) NOT NULL,
            \`other_referral_details\` VARCHAR(255) DEFAULT NULL,
            \`additional_information\` TEXT DEFAULT NULL,
            \`consent_given\` TINYINT(1) NOT NULL DEFAULT 1,
            \`consent_timestamp\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`is_reviewed_by_hr\` TINYINT(1) NOT NULL DEFAULT 0,
            \`hr_reviewed_at\` TIMESTAMP NULL DEFAULT NULL,
            \`hr_reviewed_by\` VARCHAR(128) DEFAULT NULL,
            \`recruitment_status\` VARCHAR(64) NOT NULL DEFAULT 'New',
            \`admin_notes\` TEXT DEFAULT NULL,
            \`email_notification_status\` VARCHAR(64) DEFAULT 'disabled',
            \`ip_hash\` VARCHAR(64) DEFAULT NULL,
            \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`idx_ia_ref_id\` (\`reference_id\`),
            KEY \`idx_ia_email\` (\`email\`),
            KEY \`idx_ia_role\` (\`internship_role\`),
            KEY \`idx_ia_status\` (\`recruitment_status\`),
            KEY \`idx_ia_created_at\` (\`created_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if is_reviewed_by_hr column exists, if not add it
        try {
          await db.query(`ALTER TABLE \`internship_applications\` ADD COLUMN IF NOT EXISTS \`is_reviewed_by_hr\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`consent_timestamp\``);
          await db.query(`ALTER TABLE \`internship_applications\` ADD COLUMN IF NOT EXISTS \`hr_reviewed_at\` TIMESTAMP NULL DEFAULT NULL AFTER \`is_reviewed_by_hr\``);
          await db.query(`ALTER TABLE \`internship_applications\` ADD COLUMN IF NOT EXISTS \`hr_reviewed_by\` VARCHAR(128) DEFAULT NULL AFTER \`hr_reviewed_at\``);
        } catch (colErr) {
          // Ignore if exists
        }

        const sql = `
          INSERT INTO \`internship_applications\` (
            reference_id, full_name, email, phone, city_state, linkedin_url,
            college, degree, study_year, graduation_year, cgpa_range,
            internship_role, skills, strongest_skills, projects_experience, github_portfolio_url,
            resume_filename, resume_drive_file_id, resume_drive_url, resume_storage_key,
            resume_mime_type, resume_size_bytes,
            motivation, expected_contribution, internship_mode, duration,
            joining_availability, specific_joining_date, weekly_hours,
            referral_source, other_referral_details, additional_information,
            consent_given, is_reviewed_by_hr, recruitment_status, email_notification_status, ip_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const skillsJson = JSON.stringify(appData.skills);
        const params = [
          appData.reference_id,
          appData.full_name,
          appData.email,
          appData.phone,
          appData.city_state,
          appData.linkedin_url,
          appData.college,
          appData.degree,
          appData.study_year,
          appData.graduation_year,
          appData.cgpa_range,
          appData.internship_role,
          skillsJson,
          appData.strongest_skills,
          appData.projects_experience,
          appData.github_portfolio_url,
          appData.resume_filename,
          appData.resume_drive_file_id,
          appData.resume_drive_url,
          appData.resume_storage_key,
          appData.resume_mime_type,
          appData.resume_size_bytes,
          appData.motivation,
          appData.expected_contribution,
          appData.internship_mode,
          appData.duration,
          appData.joining_availability,
          appData.specific_joining_date,
          appData.weekly_hours,
          appData.referral_source,
          appData.other_referral_details,
          appData.additional_information,
          appData.consent_given,
          appData.is_reviewed_by_hr,
          appData.recruitment_status,
          appData.email_notification_status,
          appData.ip_hash || null
        ];

        const result = await db.query(sql, params);
        savedId = result.insertId;
        appData.id = savedId;
        savedInDb = true;
      }
    } catch (dbErr) {
      console.warn('[InternshipService] MySQL insert threw, persisting to local JSON fallback:', dbErr.message);
    }

    // Mirror to local JSON fallback
    const localApps = this.readLocalApplications();
    if (!appData.id) {
      appData.id = Date.now();
    }
    localApps.unshift(appData);
    this.writeLocalApplications(localApps);

    // 5. Create initial audit history record: 'New'
    await this.recordStatusHistory({
      applicationId: appData.id,
      referenceId: appData.reference_id,
      previousStatus: 'None',
      newStatus: 'New',
      changedById: 'applicant',
      changedByName: appData.full_name,
      changedByRole: 'Applicant',
      notes: 'Initial application submitted via Careers portal.'
    });

    return {
      success: true,
      referenceId: appData.reference_id,
      applicationId: appData.id,
      resumeFilename: appData.resume_filename,
      message: 'Your internship application has been successfully submitted to PUVIMA Consultancy.'
    };
  }

  /**
   * Append audit trail entry for status change
   */
  async recordStatusHistory({ applicationId, referenceId, previousStatus, newStatus, changedById, changedByName, changedByRole, notes }) {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      application_id: applicationId,
      reference_id: referenceId,
      previous_status: previousStatus || 'None',
      new_status: newStatus,
      changed_by_id: changedById || null,
      changed_by_name: changedByName || 'System',
      changed_by_role: changedByRole || 'Admin',
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS \`internship_application_history\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            \`application_id\` BIGINT UNSIGNED NOT NULL,
            \`reference_id\` VARCHAR(64) NOT NULL,
            \`previous_status\` VARCHAR(64) NOT NULL,
            \`new_status\` VARCHAR(64) NOT NULL,
            \`changed_by_id\` VARCHAR(64) DEFAULT NULL,
            \`changed_by_name\` VARCHAR(128) DEFAULT NULL,
            \`changed_by_role\` VARCHAR(64) DEFAULT NULL,
            \`notes\` TEXT DEFAULT NULL,
            \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_iah_app_id\` (\`application_id\`),
            KEY \`idx_iah_ref_id\` (\`reference_id\`),
            KEY \`idx_iah_created_at\` (\`created_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const sql = `
          INSERT INTO \`internship_application_history\`
          (application_id, reference_id, previous_status, new_status, changed_by_id, changed_by_name, changed_by_role, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const res = await db.query(sql, [
          entry.application_id,
          entry.reference_id,
          entry.previous_status,
          entry.new_status,
          entry.changed_by_id,
          entry.changed_by_name,
          entry.changed_by_role,
          entry.notes
        ]);
        if (res && res.insertId) {
          entry.id = res.insertId;
        }
      }
    } catch (err) {
      console.warn('[InternshipService] MySQL history record warning:', err.message);
    }

    // 2. Mirror into JSON
    const history = this.readLocalHistory();
    history.push(entry);
    this.writeLocalHistory(history);

    return entry;
  }

  /**
   * Retrieve audit history for an application
   */
  async getApplicationHistory(idOrRef) {
    if (!idOrRef) return [];

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const sql = 'SELECT * FROM `internship_application_history` WHERE application_id = ? OR reference_id = ? ORDER BY created_at ASC';
        const rows = await db.query(sql, [idOrRef, idOrRef]);
        if (rows && rows.length > 0) return rows;
      }
    } catch (err) {
      console.warn('[InternshipService] MySQL getApplicationHistory warning:', err.message);
    }

    // 2. Fallback to local JSON
    const history = this.readLocalHistory();
    const filtered = history.filter(
      (h) => String(h.application_id) === String(idOrRef) || h.reference_id === String(idOrRef)
    );
    return filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  /**
   * Mark application as reviewed by HR
   */
  async markReviewedByHr(idOrRef, hrUser = {}) {
    const app = await this.getApplicationByIdAdmin(idOrRef);
    if (!app) {
      throw new Error(`Internship application '${idOrRef}' not found.`);
    }

    const reviewedAt = new Date().toISOString();
    const reviewerName = hrUser.name || hrUser.userId || 'HR Coordinator';

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const sql = 'UPDATE `internship_applications` SET is_reviewed_by_hr = 1, hr_reviewed_at = CURRENT_TIMESTAMP, hr_reviewed_by = ? WHERE id = ? OR reference_id = ?';
        await db.query(sql, [reviewerName, app.id, app.reference_id]);
      }
    } catch (err) {
      console.warn('[InternshipService] MySQL markReviewedByHr warning:', err.message);
    }

    // 2. Fallback to local JSON
    const apps = this.readLocalApplications();
    const idx = apps.findIndex(
      (a) => String(a.id) === String(app.id) || a.reference_id === app.reference_id
    );
    if (idx !== -1) {
      apps[idx].is_reviewed_by_hr = 1;
      apps[idx].hr_reviewed_at = reviewedAt;
      apps[idx].hr_reviewed_by = reviewerName;
      this.writeLocalApplications(apps);
    }

    return {
      ...app,
      is_reviewed_by_hr: 1,
      hr_reviewed_at: reviewedAt,
      hr_reviewed_by: reviewerName
    };
  }

  /**
   * Aggregate statistics for the 6 application lifecycle statuses + HR unread
   */
  async getApplicationStats() {
    const stats = {
      total: 0,
      new: 0,
      under_review: 0,
      shortlisted: 0,
      interview: 0,
      selected: 0,
      rejected: 0,
      unread_by_hr: 0
    };

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const [counts] = await db.query(`
          SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(recruitment_status) IN ('new', 'received') THEN 1 ELSE 0 END) AS count_new,
            SUM(CASE WHEN LOWER(recruitment_status) IN ('under review', 'under_review') THEN 1 ELSE 0 END) AS count_under_review,
            SUM(CASE WHEN LOWER(recruitment_status) = 'shortlisted' THEN 1 ELSE 0 END) AS count_shortlisted,
            SUM(CASE WHEN LOWER(recruitment_status) = 'interview' THEN 1 ELSE 0 END) AS count_interview,
            SUM(CASE WHEN LOWER(recruitment_status) = 'selected' THEN 1 ELSE 0 END) AS count_selected,
            SUM(CASE WHEN LOWER(recruitment_status) = 'rejected' THEN 1 ELSE 0 END) AS count_rejected,
            SUM(CASE WHEN is_reviewed_by_hr = 0 OR is_reviewed_by_hr IS NULL THEN 1 ELSE 0 END) AS count_unread
          FROM \`internship_applications\`
        `);

        if (counts) {
          stats.total = Number(counts.total) || 0;
          stats.new = Number(counts.count_new) || 0;
          stats.under_review = Number(counts.count_under_review) || 0;
          stats.shortlisted = Number(counts.count_shortlisted) || 0;
          stats.interview = Number(counts.count_interview) || 0;
          stats.selected = Number(counts.count_selected) || 0;
          stats.rejected = Number(counts.count_rejected) || 0;
          stats.unread_by_hr = Number(counts.count_unread) || 0;
          return stats;
        }
      }
    } catch (err) {
      console.warn('[InternshipService] MySQL getApplicationStats warning:', err.message);
    }

    // 2. Fetch from Supabase FIRST and merge with local JSON
    let apps = [];
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: sbApps, error: sbErr } = await supabase
          .from('internship_applications')
          .select('*');
        if (!sbErr && sbApps && Array.isArray(sbApps) && sbApps.length > 0) {
          apps = sbApps;
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Supabase getApplicationStats notice:', sbErr.message);
    }

    const localApps = this.readLocalApplications();
    const seenRefs = new Set(apps.map((a) => a.reference_id || String(a.id)));
    for (const localApp of localApps) {
      const key = localApp.reference_id || String(localApp.id);
      if (!seenRefs.has(key)) {
        apps.push(localApp);
        seenRefs.add(key);
      }
    }
    // Filter out archived & automated test records
    apps = apps.filter((a) => {
      const s = String(a.recruitment_status || '').toLowerCase();
      const n = String(a.full_name || '').toLowerCase();
      const e = String(a.email || '').toLowerCase();
      return s !== 'archived' && !n.includes('live verification') && !n.includes('john doe') && !e.endsWith('@example.com');
    });

    stats.total = apps.length;

    apps.forEach((a) => {
      const norm = normalizeStatus(a.recruitment_status);
      if (norm === 'New') stats.new++;
      else if (norm === 'Under Review') stats.under_review++;
      else if (norm === 'Shortlisted') stats.shortlisted++;
      else if (norm === 'Interview') stats.interview++;
      else if (norm === 'Selected') stats.selected++;
      else if (norm === 'Rejected') stats.rejected++;

      if (!a.is_reviewed_by_hr) {
        stats.unread_by_hr++;
      }
    });

    return stats;
  }

  /**
   * Administrative listing of candidate applications with search, role, status, and date filters
   * @param {Object} query 
   * @returns {Promise<{ total: number, applications: Array }>}
   */
  async getApplicationsAdmin(query = {}) {
    const { status, role, search, date, limit = 50, offset = 0 } = query;

    const normalizedFilterStatus = normalizeStatus(status);

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = 'SELECT * FROM `internship_applications` WHERE 1=1';
        const params = [];

        if (status && status !== 'all') {
          if (normalizedFilterStatus === 'New') {
            sql += ' AND LOWER(recruitment_status) IN (?, ?)';
            params.push('new', 'received');
          } else if (normalizedFilterStatus === 'Under Review') {
            sql += ' AND LOWER(recruitment_status) IN (?, ?)';
            params.push('under review', 'under_review');
          } else if (normalizedFilterStatus) {
            sql += ' AND LOWER(recruitment_status) = ?';
            params.push(normalizedFilterStatus.toLowerCase());
          }
        }

        if (role && role !== 'all') {
          sql += ' AND internship_role = ?';
          params.push(role);
        }

        if (date) {
          sql += ' AND DATE(created_at) = ?';
          params.push(date);
        }

        if (search && search.trim()) {
          const term = `%${search.trim()}%`;
          sql += ' AND (full_name LIKE ? OR email LIKE ? OR reference_id LIKE ? OR college LIKE ?)';
          params.push(term, term, term, term);
        }

        // Count total matching
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRow] = await db.query(countSql, params);
        const total = countRow ? Number(countRow.total) : 0;

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const rows = await db.query(sql, params);

        const mapped = rows.map((r) => {
          let skills = [];
          if (r.skills) {
            try {
              skills = typeof r.skills === 'string' ? JSON.parse(r.skills) : r.skills;
            } catch (e) {
              skills = [r.skills];
            }
          }
          return {
            ...r,
            skills,
            recruitment_status: normalizeStatus(r.recruitment_status) || 'New',
            is_reviewed_by_hr: r.is_reviewed_by_hr ? 1 : 0
          };
        });

        return { total, applications: mapped };
      }
    } catch (dbErr) {
      console.warn('[InternshipService] Admin query from MySQL failed, falling back to local storage:', dbErr.message);
    }

    // 2. Fetch from Supabase FIRST and merge with local JSON
    let apps = [];
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: sbApps, error: sbErr } = await supabase
          .from('internship_applications')
          .select('*')
          .order('created_at', { ascending: false });
        if (!sbErr && sbApps && Array.isArray(sbApps) && sbApps.length > 0) {
          apps = sbApps;
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Supabase getApplicationsAdmin notice:', sbErr.message);
    }

    const localApps = this.readLocalApplications();
    const seenRefs = new Set(apps.map((a) => a.reference_id || String(a.id)));
    for (const localApp of localApps) {
      const key = localApp.reference_id || String(localApp.id);
      if (!seenRefs.has(key)) {
        apps.push(localApp);
        seenRefs.add(key);
      }
    }

    // Filter out archived and test candidate entries
    apps = apps.filter((a) => {
      const s = String(a.recruitment_status || '').toLowerCase();
      const n = String(a.full_name || '').toLowerCase();
      const e = String(a.email || '').toLowerCase();
      return s !== 'archived' && !n.includes('live verification') && !n.includes('john doe') && !e.endsWith('@example.com');
    });

    // Normalize applications from either store
    apps = apps.map((a) => {
      let skills = a.skills;
      if (typeof skills === 'string') {
        try { skills = JSON.parse(skills); } catch (e) { skills = [skills]; }
      }
      return {
        ...a,
        skills: Array.isArray(skills) ? skills : [],
        recruitment_status: normalizeStatus(a.recruitment_status) || 'New',
        is_reviewed_by_hr: a.is_reviewed_by_hr ? 1 : 0
      };
    });

    if (status && status !== 'all') {
      apps = apps.filter((a) => normalizeStatus(a.recruitment_status) === normalizedFilterStatus);
    }

    if (role && role !== 'all') {
      apps = apps.filter((a) => a.internship_role === role);
    }

    if (date) {
      apps = apps.filter((a) => (a.created_at || '').slice(0, 10) === date);
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      apps = apps.filter(
        (a) =>
          (a.full_name && a.full_name.toLowerCase().includes(s)) ||
          (a.email && a.email.toLowerCase().includes(s)) ||
          (a.reference_id && a.reference_id.toLowerCase().includes(s)) ||
          (a.college && a.college.toLowerCase().includes(s))
      );
    }

    const total = apps.length;
    const paginated = apps.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

    return { total, applications: paginated };
  }

  /**
   * Retrieve single application detail by ID or reference_id
   * @param {string|number} idOrRef 
   * @returns {Promise<Object|null>}
   */
  async getApplicationByIdAdmin(idOrRef) {
    if (!idOrRef) return null;

    // 1. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const isNumeric = /^\d+$/.test(String(idOrRef).trim());
        const sql = isNumeric
          ? 'SELECT * FROM `internship_applications` WHERE id = ? LIMIT 1'
          : 'SELECT * FROM `internship_applications` WHERE reference_id = ? LIMIT 1';
        let rows = await db.query(sql, [idOrRef]);
        if ((!rows || rows.length === 0) && isNumeric) {
          rows = await db.query('SELECT * FROM `internship_applications` WHERE reference_id = ? LIMIT 1', [idOrRef]);
        }
        if (rows && rows.length > 0) {
          const row = rows[0];
          let skills = [];
          if (row.skills) {
            try {
              skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
            } catch (e) {
              skills = [row.skills];
            }
          }
          return {
            ...row,
            skills,
            recruitment_status: normalizeStatus(row.recruitment_status) || 'New',
            is_reviewed_by_hr: row.is_reviewed_by_hr ? 1 : 0
          };
        }
      }
    } catch (dbErr) {
      console.warn('[InternshipService] MySQL getApplicationById error:', dbErr.message);
    }

    // 2. Try Supabase
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        const str = String(idOrRef).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        let query = supabase.from('internship_applications').select('*');
        if (isUuid) {
          query = query.eq('id', str);
        } else {
          query = query.eq('reference_id', str);
        }
        let { data, error } = await query.maybeSingle();

        if (!data && !isUuid && /^\d+$/.test(str)) {
          // If numeric local ID was passed, also try matching reference_id
          const r = await supabase.from('internship_applications').select('*').eq('reference_id', str).maybeSingle();
          if (r && r.data) data = r.data;
        }

        if (!error && data) {
          let skills = [];
          if (data.skills) {
            try {
              skills = typeof data.skills === 'string' ? JSON.parse(data.skills) : data.skills;
            } catch (e) {
              skills = [data.skills];
            }
          }
          return {
            ...data,
            skills,
            recruitment_status: normalizeStatus(data.recruitment_status) || 'New',
            is_reviewed_by_hr: data.is_reviewed_by_hr ? 1 : 0
          };
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Supabase getApplicationByIdAdmin notice:', sbErr.message);
    }

    // 3. Fallback to Local JSON
    const apps = this.readLocalApplications();
    const found = apps.find(
      (a) => String(a.id) === String(idOrRef) || a.reference_id === String(idOrRef)
    );
    if (found) {
      return {
        ...found,
        recruitment_status: normalizeStatus(found.recruitment_status) || 'New',
        is_reviewed_by_hr: found.is_reviewed_by_hr ? 1 : 0
      };
    }

    return null;
  }

  /**
   * Update candidate recruitment status and administrator / coordinator notes
   * Automatically records audit history entry
   * @param {string|number} idOrRef 
   * @param {Object} updates 
   * @param {Object} user 
   * @returns {Promise<Object>}
   */
  async updateApplicationStatus(idOrRef, updates = {}, user = {}) {
    const { status, admin_notes, notes } = updates;

    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) {
      throw new Error(
        `Invalid status: '${status}'. Allowed statuses: ${CANONICAL_STATUSES.join(', ')}`
      );
    }

    const application = await this.getApplicationByIdAdmin(idOrRef);
    if (!application) {
      throw new Error(`Internship application '${idOrRef}' not found.`);
    }

    const previousStatus = application.recruitment_status || 'New';
    const now = new Date().toISOString();
    const noteText = notes !== undefined ? notes : (admin_notes !== undefined ? admin_notes : application.admin_notes);

    // 1. Update in MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        const sql = 'UPDATE `internship_applications` SET recruitment_status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR reference_id = ?';
        await db.query(sql, [normalizedStatus, noteText, application.id, application.reference_id]);
      }
    } catch (dbErr) {
      console.warn('[InternshipService] MySQL status update error:', dbErr.message);
    }

    // 1b. Mirror update in Supabase
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        if (application.reference_id) {
          await supabase
            .from('internship_applications')
            .update({
              recruitment_status: normalizedStatus,
              admin_notes: noteText,
              updated_at: now
            })
            .eq('reference_id', application.reference_id);
        } else if (application.id) {
          await supabase
            .from('internship_applications')
            .update({
              recruitment_status: normalizedStatus,
              admin_notes: noteText,
              updated_at: now
            })
            .eq('id', application.id);
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Supabase status update notice:', sbErr.message);
    }

    // 2. Mirror update in local JSON
    const localApps = this.readLocalApplications();
    const idx = localApps.findIndex(
      (a) => String(a.id) === String(application.id) || a.reference_id === application.reference_id
    );
    if (idx !== -1) {
      localApps[idx].recruitment_status = normalizedStatus;
      localApps[idx].admin_notes = noteText;
      localApps[idx].updated_at = now;
      this.writeLocalApplications(localApps);
    }

    // 3. Record in audit history
    await this.recordStatusHistory({
      applicationId: application.id,
      referenceId: application.reference_id,
      previousStatus,
      newStatus: normalizedStatus,
      changedById: user.userId || user.id || null,
      changedByName: user.name || 'Staff User',
      changedByRole: user.role || 'Coordinator',
      notes: noteText
    });

    return {
      ...application,
      recruitment_status: normalizedStatus,
      admin_notes: noteText,
      updated_at: now
    };
  }

  /**
   * Delete an internship application from Supabase and local data stores
   * @param {string} idOrRef
   * @param {Object} user
   */
  async deleteApplicationAdmin(idOrRef, user = {}) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(idOrRef).trim());

    // 1. Supabase deletion / archive
    try {
      const { getSupabaseClient } = require('../config/supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        if (isUuid) {
          await supabase.from('internship_applications').update({ recruitment_status: 'Archived' }).eq('id', idOrRef);
          await supabase.from('internship_applications').delete().eq('id', idOrRef);
        } else {
          await supabase.from('internship_applications').update({ recruitment_status: 'Archived' }).eq('reference_id', idOrRef);
          await supabase.from('internship_applications').delete().eq('reference_id', idOrRef);
        }
      }
    } catch (sbErr) {
      console.warn('[InternshipService] Supabase delete notice:', sbErr.message);
    }

    // 2. Local storage deletion
    this.removeLocalApplication(idOrRef);

    return {
      success: true,
      message: 'Application record deleted successfully'
    };
  }

  removeLocalApplication(idOrRef) {
    const cleanId = String(idOrRef || '').trim();
    [DATA_FILE, BACKEND_DATA_FILE].forEach((fPath) => {
      try {
        if (fs.existsSync(fPath)) {
          const raw = JSON.parse(fs.readFileSync(fPath, 'utf8'));
          const list = Array.isArray(raw) ? raw : (raw.applications || []);
          const filtered = list.filter((a) => String(a.id) !== cleanId && a.reference_id !== cleanId);
          fs.writeFileSync(fPath, JSON.stringify(Array.isArray(raw) ? filtered : { applications: filtered }, null, 2), 'utf8');
        }
      } catch (err) {
        console.warn('[InternshipService] Could not remove from ' + fPath + ':', err.message);
      }
    });
  }
}

module.exports = new InternshipService();
