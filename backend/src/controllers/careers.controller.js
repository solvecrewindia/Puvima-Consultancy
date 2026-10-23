/**
 * PUVIMA Consultancy — Careers & Applications Controller
 * Handles public job listings, candidate submissions, and administrative hiring workflows.
 */

const careersService = require('../services/careers.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9()\-\s.]{7,30}$/;

class CareersController {

  // ==========================================================================
  // PUBLIC ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/careers
   * List all published job positions for candidate viewing.
   */
  async getPublishedPositions(req, res) {
    try {
      const { department, search } = req.query;
      const positions = await careersService.getPublishedPositions({ department, search });

      return res.status(200).json({
        success: true,
        count: positions.length,
        positions
      });
    } catch (err) {
      console.error('[CareersController] Error fetching published positions:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve career opportunities at this time.'
      });
    }
  }

  /**
   * GET /api/careers/:id
   * Retrieve published position details.
   */
  async getPositionById(req, res) {
    try {
      const { id } = req.params;
      const position = await careersService.getPositionById(id, { allowUnpublished: false });

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'The requested job position was not found or is currently closed.'
        });
      }

      return res.status(200).json({
        success: true,
        position
      });
    } catch (err) {
      console.error('[CareersController] Error fetching position details:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve position details.'
      });
    }
  }

  /**
   * POST /api/careers/:id/apply
   * Submit a candidate application with resume.
   */
  async applyForPosition(req, res) {
    const { id } = req.params;
    const body = req.body || {};
    const errors = {};

    // 1. Validation: Full Name
    const name = (body.applicant_name || body.name || '').trim();
    if (!name || name.length < 2) {
      errors.applicant_name = 'Full legal name is required (minimum 2 characters).';
    } else if (name.length > 128) {
      errors.applicant_name = 'Full name must not exceed 128 characters.';
    }

    // 2. Validation: Email
    const email = (body.applicant_email || body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      errors.applicant_email = 'A valid contact email address is required.';
    } else if (email.length > 255) {
      errors.applicant_email = 'Email address is too long.';
    }

    // 3. Validation: Phone
    const phone = (body.applicant_phone || body.phone || '').trim();
    if (!phone || !PHONE_REGEX.test(phone)) {
      errors.applicant_phone = 'A valid phone number is required (minimum 7 digits).';
    }

    // 4. Validation: URLs (Optional, but validate if present)
    const linkedin = (body.linkedin_url || body.linkedin || '').trim();
    if (linkedin && !linkedin.startsWith('http://') && !linkedin.startsWith('https://')) {
      errors.linkedin_url = 'LinkedIn URL must start with http:// or https://';
    }

    const portfolio = (body.portfolio_url || body.portfolio || '').trim();
    if (portfolio && !portfolio.startsWith('http://') && !portfolio.startsWith('https://')) {
      errors.portfolio_url = 'Portfolio or GitHub URL must start with http:// or https://';
    }

    // 5. Validation: Resume Document
    if (!req.resumeData) {
      errors.resume = 'A valid resume file (PDF, DOC, or DOCX) is required.';
    }

    // 6. Privacy Consent
    const consent = body.consent;
    if (consent === undefined || consent === false || consent === 'false') {
      errors.consent = 'You must acknowledge the privacy notice and consent to application processing.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Application form validation failed. Please review the highlighted fields.',
        errors
      });
    }

    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const result = await careersService.submitApplication(
        id,
        {
          applicant_name: name,
          applicant_email: email,
          applicant_phone: phone,
          education: (body.education || '').trim(),
          skills: (body.skills || '').trim(),
          experience_years: (body.experience_years || body.experience || '').trim(),
          linkedin_url: linkedin || null,
          portfolio_url: portfolio || null,
          cover_letter: (body.cover_letter || body.message || '').trim()
        },
        req.resumeData,
        clientIp
      );

      return res.status(201).json({
        success: true,
        ...result
      });
    } catch (err) {
      if (err.message && err.message.includes('not exist') || err.message.includes('no longer accepting')) {
        return res.status(404).json({
          success: false,
          message: err.message
        });
      }

      console.error('[CareersController] Submission error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'An internal error occurred while processing your application. Please try again later.'
      });
    }
  }

  // ==========================================================================
  // ADMIN ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/admin/careers
   * List all configured positions.
   */
  async getAllPositionsAdmin(req, res) {
    try {
      const { status, department, search } = req.query;
      const positions = await careersService.getAllPositionsAdmin({ status, department, search });

      return res.status(200).json({
        success: true,
        count: positions.length,
        positions
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve positions: ' + err.message
      });
    }
  }

  /**
   * POST /api/admin/careers
   * Create a new job vacancy.
   */
  async createPositionAdmin(req, res) {
    const data = req.body || {};
    const errors = {};

    if (!data.title || !data.title.trim()) {
      errors.title = 'Job title is required.';
    }
    if (!data.department || !data.department.trim()) {
      errors.department = 'Department/practice area is required.';
    }
    if (!data.description || !data.description.trim()) {
      errors.description = 'Job overview/description is required.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Position creation failed. Missing required fields.',
        errors
      });
    }

    try {
      const created = await careersService.createPosition(data);
      return res.status(201).json({
        success: true,
        message: 'Job position created successfully.',
        position: created
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create job position: ' + err.message
      });
    }
  }

  /**
   * PUT /api/admin/careers/:id
   * Update an existing job vacancy.
   */
  async updatePositionAdmin(req, res) {
    const { id } = req.params;
    const data = req.body || {};

    try {
      const existing = await careersService.getPositionById(id, { allowUnpublished: true });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Job position not found.'
        });
      }

      const updated = await careersService.updatePosition(id, data);
      return res.status(200).json({
        success: true,
        message: 'Job position updated successfully.',
        position: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update job position: ' + err.message
      });
    }
  }

  /**
   * PATCH /api/admin/careers/:id/status
   * Publish, close, or draft a position.
   */
  async updatePositionStatusAdmin(req, res) {
    const { id } = req.params;
    const { status } = req.body || {};

    const validStatuses = ['draft', 'published', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid position status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    try {
      const existing = await careersService.getPositionById(id, { allowUnpublished: true });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Job position not found.'
        });
      }

      const updated = await careersService.updatePositionStatus(id, status);
      return res.status(200).json({
        success: true,
        message: `Job position status updated to '${status}'.`,
        position: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update position status: ' + err.message
      });
    }
  }

  /**
   * DELETE /api/admin/careers/:id
   */
  async deletePositionAdmin(req, res) {
    const { id } = req.params;
    try {
      await careersService.deletePosition(id);
      return res.status(200).json({
        success: true,
        message: 'Job position successfully deleted.'
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * GET /api/admin/applications
   * List candidate applications with search and filters.
   */
  async getApplicationsAdmin(req, res) {
    try {
      const { jobId, status, search, limit, offset } = req.query;
      const data = await careersService.getApplicationsAdmin({
        jobId,
        status,
        search,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0
      });

      return res.status(200).json({
        success: true,
        total: data.total,
        count: data.applications.length,
        applications: data.applications
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve applications: ' + err.message
      });
    }
  }

  /**
   * GET /api/admin/applications/:id
   * Retrieve single application detail.
   */
  async getApplicationByIdAdmin(req, res) {
    try {
      const { id } = req.params;
      const application = await careersService.getApplicationByIdAdmin(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Candidate application not found.'
        });
      }

      return res.status(200).json({
        success: true,
        application
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve application details: ' + err.message
      });
    }
  }

  /**
   * PATCH /api/admin/applications/:id/status
   * Update candidate recruitment status.
   */
  async updateApplicationStatusAdmin(req, res) {
    const { id } = req.params;
    const { status, admin_notes } = req.body || {};

    try {
      const updated = await careersService.updateApplicationStatus(id, { status, admin_notes });
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Candidate application not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: `Candidate application status updated to '${status}'.`,
        application: updated
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * GET /api/admin/applications/:id/resume
   * Securely stream or download applicant resume document.
   */
  async getApplicationResumeAdmin(req, res) {
    const { id } = req.params;

    try {
      const resumeInfo = await careersService.getApplicationResumePath(id);

      if (!resumeInfo) {
        return res.status(404).json({
          success: false,
          message: 'The requested resume document could not be located on the server.'
        });
      }

      res.setHeader('Content-Type', resumeInfo.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resumeInfo.filename)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      return res.sendFile(resumeInfo.filePath);
    } catch (err) {
      console.error('[CareersController] Resume download error:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Access denied: ' + err.message
      });
    }
  }
}

module.exports = new CareersController();
