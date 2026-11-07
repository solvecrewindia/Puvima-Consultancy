/**
 * PUVIMA Consultancy — Internship Applications Controller
 * Express controller for public candidate submission, HR Portal management,
 * and Super Admin oversight with status transition audit trail.
 */

const internshipService = require('../services/internship.service');
const googleDriveService = require('../services/googleDrive.service');
const fs = require('fs');
const path = require('path');

class InternshipController {
  /**
   * POST /api/internship-applications
   * Public endpoint to submit a candidate internship application with resume file.
   * Completely removes automatic recruitment emails to HR / Super Admin.
   */
  async submitApplication(req, res) {
    try {
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const body = req.body || {};
      const file = req.file;

      const result = await internshipService.submitApplication(body, file, clientIp);

      return res.status(201).json({
        success: true,
        ...result
      });
    } catch (err) {
      if (err.statusCode === 400 && err.errors) {
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: err.errors
        });
      }

      console.error('[InternshipController] Application submission error:', err.message);
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'An error occurred while processing your internship application.'
      });
    }
  }

  /**
   * GET /api/admin/internship-applications & GET /api/hr/internship-applications
   * Lists applications with search, status, role, and date filtering
   */
  async getApplications(req, res) {
    try {
      const { status, role, search, date, limit, offset } = req.query;
      const data = await internshipService.getApplicationsAdmin({
        status,
        role,
        search,
        date,
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
      console.error('[InternshipController] getApplications error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve internship applications: ' + err.message
      });
    }
  }

  /**
   * GET /api/admin/internship-applications/stats & GET /api/hr/internship-applications/stats
   * Returns counts across the 6 application lifecycle statuses + HR unread count
   */
  async getStats(req, res) {
    try {
      const stats = await internshipService.getApplicationStats();
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (err) {
      console.error('[InternshipController] getStats error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve application statistics: ' + err.message
      });
    }
  }

  /**
   * GET /api/admin/internship-applications/:id & GET /api/hr/internship-applications/:id
   * Retrieves single application details
   */
  async getApplicationById(req, res) {
    try {
      const { id } = req.params;
      const application = await internshipService.getApplicationByIdAdmin(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: `Internship application '${id}' not found.`
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
   * PATCH /api/hr/internship-applications/:id/reviewed
   * Marks application as reviewed by HR coordinator
   */
  async markReviewedByHr(req, res) {
    try {
      const { id } = req.params;
      const updated = await internshipService.markReviewedByHr(id, req.user || {});

      return res.status(200).json({
        success: true,
        message: 'Application marked as reviewed by HR.',
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
   * PATCH /api/admin/internship-applications/:id/status & PATCH /api/hr/internship-applications/:id/status
   * Updates recruitment status with notes and logs status audit history
   */
  async updateApplicationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes, notes } = req.body || {};

      const updated = await internshipService.updateApplicationStatus(
        id,
        { status, admin_notes, notes },
        req.user || {}
      );

      return res.status(200).json({
        success: true,
        message: `Application status updated to '${updated.recruitment_status}'.`,
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
   * GET /api/admin/internship-applications/:id/history
   * Retrieves status audit history
   */
  async getApplicationHistory(req, res) {
    try {
      const { id } = req.params;
      const history = await internshipService.getApplicationHistory(id);

      return res.status(200).json({
        success: true,
        history
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve status history: ' + err.message
      });
    }
  }

  /**
   * GET /api/admin/internship-applications/:id/resume & GET /api/hr/internship-applications/:id/resume
   * Securely streams candidate resume or displays an honest unavailable message
   */
  async getApplicationResume(req, res) {
    try {
      const { id } = req.params;
      const app = await internshipService.getApplicationByIdAdmin(id);

      if (!app) {
        return res.status(404).json({
          success: false,
          message: 'Internship application not found.'
        });
      }

      // 1. Check local disk storage
      const localResumesDir = process.env.VERCEL
        ? path.join(require('os').tmpdir(), 'puvima-resumes')
        : path.resolve(__dirname, '../../uploads/resumes');
      const localPath = app.resume_storage_key ? path.join(localResumesDir, app.resume_storage_key) : null;

      if (localPath && fs.existsSync(localPath)) {
        res.setHeader('Content-Type', app.resume_mime_type || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(app.resume_filename || 'resume.pdf')}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(localPath);
      }

      // 2. Check Google Drive if configured
      if (app.resume_drive_file_id && googleDriveService.isConfigured()) {
        try {
          const { stream, metadata } = await googleDriveService.downloadFileStream(app.resume_drive_file_id);
          res.setHeader('Content-Type', metadata.mimeType || app.resume_mime_type || 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(metadata.name || app.resume_filename)}"`);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          return stream.pipe(res);
        } catch (driveErr) {
          console.warn('[InternshipController] Google Drive download failed:', driveErr.message);
        }
      }

      // 3. Fallback: Honest unavailable message
      const candidateName = app.full_name || 'the candidate';
      const resumeName = app.resume_filename || 'Submitted Resume Document';
      const email = app.email || 'the applicant';

      if (req.accepts('html')) {
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Resume Unavailable — PUVIMA Management</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; }
              .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); text-align: center; }
              .icon { width: 54px; height: 54px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
              h2 { margin: 0 0 12px; font-size: 20px; color: #f8fafc; }
              p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 8px 0; }
              .badge { display: inline-block; background: #334155; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-family: monospace; margin-top: 12px; }
              .btn { margin-top: 24px; display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </div>
              <h2>Resume File Currently Unavailable</h2>
              <p>The candidate <strong>${candidateName}</strong> submitted their resume as:</p>
              <div class="badge">${resumeName}</div>
              <p style="margin-top: 16px;">The physical file is currently not present in local storage on this host server. You may contact the candidate directly at <a href="mailto:${email}" style="color: #38bdf8;">${email}</a> to request a copy.</p>
              <a href="javascript:window.close()" class="btn">Close Window</a>
            </div>
          </body>
          </html>
        `);
      }

      return res.status(404).json({
        success: false,
        message: `Resume file '${resumeName}' is currently unavailable in local storage. Please contact the candidate at ${email}.`
      });
    } catch (err) {
      console.error('[InternshipController] Resume preview error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to stream resume: ' + err.message
      });
    }
  }

  // Alias methods for backwards compatibility
  getApplicationsAdmin(req, res) { return this.getApplications(req, res); }
  getApplicationByIdAdmin(req, res) { return this.getApplicationById(req, res); }
  updateApplicationStatusAdmin(req, res) { return this.updateApplicationStatus(req, res); }
  getApplicationResumeAdmin(req, res) { return this.getApplicationResume(req, res); }
}

module.exports = new InternshipController();
