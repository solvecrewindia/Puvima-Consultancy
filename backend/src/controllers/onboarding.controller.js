/**
 * PUVIMA Consultancy — Onboarding & HR Verification Controller
 */

const path = require('path');
const fs = require('fs');
const onboardingService = require('../services/onboarding.service');
const onboardingPdfService = require('../services/onboardingPdf.service');

const BASE_UPLOAD_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'puvima-onboarding-docs')
  : path.resolve(__dirname, '../../uploads/onboarding');

class OnboardingController {

  // POST /api/onboarding/init
  async initApplication(req, res) {
    try {
      const { email, name, phone, position } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: 'Applicant email address is required.' });
      }

      const application = await onboardingService.initOrGetApplication({ email, name, phone, position });
      return res.status(200).json({
        success: true,
        message: 'Onboarding application initialized successfully.',
        application,
        token: application.access_token
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/onboarding/:id
  async getApplication(req, res) {
    try {
      const appId = req.params.id;
      const app = await onboardingService.getApplication(appId, false);
      if (!app) {
        return res.status(404).json({ success: false, message: 'Onboarding application not found.' });
      }

      return res.status(200).json({ success: true, application: app });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /api/onboarding/:id/step/:stepNumber
  async saveStep(req, res) {
    try {
      const appId = req.params.id;
      const stepNumber = req.params.stepNumber;
      const updated = await onboardingService.saveStep(appId, stepNumber, req.body || {});

      return res.status(200).json({
        success: true,
        message: `Step ${stepNumber} saved successfully.`,
        application: updated
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/onboarding/:id/document
  async uploadDocument(req, res) {
    try {
      const appId = req.params.id;
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No document file uploaded.' });
      }

      const category = (req.body.category || 'other_docs').toLowerCase().trim();
      const doc = await onboardingService.attachDocument(appId, {
        category,
        originalFilename: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      });

      return res.status(200).json({
        success: true,
        message: `${category} uploaded successfully.`,
        document: doc
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // DELETE /api/onboarding/:id/document/:docId
  async deleteDocument(req, res) {
    try {
      const { id, docId } = req.params;
      const removed = await onboardingService.deleteDocument(id, docId);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }
      return res.status(200).json({ success: true, message: 'Document removed successfully.' });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/onboarding/:id/document/:docId
  async serveDocument(req, res) {
    try {
      const { id, docId } = req.params;
      const app = await onboardingService.getApplication(id, true);
      if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

      const doc = (app.documents || []).find(d => d.id === docId || d.category === docId);
      if (!doc) return res.status(404).json({ success: false, message: 'Document record not found.' });

      // Look in uploads folder
      const sanitizedAppDir = app.id.replace(/[^a-zA-Z0-9_-]/g, '');
      let filePath = path.join(BASE_UPLOAD_DIR, sanitizedAppDir, doc.storage_path);

      if (!fs.existsSync(filePath)) {
        // Fallback check in base upload dir
        filePath = path.join(BASE_UPLOAD_DIR, doc.storage_path);
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Document file not found on disk.' });
      }

      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/onboarding/:id/submit
  async submitApplication(req, res) {
    try {
      const appId = req.params.id;
      const b = req.body || {};
      const declarationAccepted = b.declarationAccepted !== undefined ? b.declarationAccepted : b.declaration_accepted;
      const signatureName = b.signatureName || b.applicant_signature_name;

      const submitted = await onboardingService.submitApplication(appId, {
        declarationAccepted: Boolean(declarationAccepted),
        signatureName
      });

      return res.status(200).json({
        success: true,
        message: 'Onboarding application confirmed and submitted successfully!',
        application: submitted
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/onboarding/:id/resubmit
  async resubmitCorrections(req, res) {
    try {
      const appId = req.params.id;
      const { changesSummary } = req.body || {};

      const resubmitted = await onboardingService.resubmitCorrections(appId, {
        changesSummary
      });

      return res.status(200).json({
        success: true,
        message: 'Application updates resubmitted to HR Operations successfully.',
        application: resubmitted
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/onboarding/:id/pdf
  async generatePdf(req, res) {
    try {
      const appId = req.params.id;
      const app = await onboardingService.getApplication(appId, true);
      if (!app) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }

      const pdfBuffer = await onboardingPdfService.generatePdfBuffer(app);
      const filename = `PUVIMA_Onboarding_${app.application_id || 'Application'}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('[OnboardingController] PDF generation error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate application PDF: ' + err.message });
    }
  }

  // GET /api/onboarding/:id/status
  async getStatus(req, res) {
    try {
      const appId = req.params.id;
      const app = await onboardingService.getApplication(appId, false);
      if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

      const history = await onboardingService.getAuditHistory(app.id);

      return res.status(200).json({
        success: true,
        application_id: app.application_id,
        id: app.id,
        token: app.access_token,
        position_applied: app.position_applied,
        status: app.status,
        submission_date: app.submission_date,
        correction_request: app.correction_request || null,
        documents: (app.documents || []).map(d => ({
          id: d.id,
          category: d.category,
          original_filename: d.original_filename,
          verification_status: d.verification_status,
          hr_remarks: d.hr_remarks
        })),
        history,
        application: app
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // --- HR CONTROLLER ENDPOINTS ---

  // GET /api/hr/onboarding/applications
  async getHrApplications(req, res) {
    try {
      const { search, position, status, page, limit } = req.query || {};
      const result = await onboardingService.getHrApplications({ search, position, status, page, limit });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/hr/onboarding/stats
  async getHrStats(req, res) {
    try {
      const stats = await onboardingService.getHrStats();
      return res.status(200).json({ success: true, stats });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/hr/onboarding/applications/:id
  async getHrApplicationDetails(req, res) {
    try {
      const appId = req.params.id;
      const app = await onboardingService.getApplication(appId, true);
      if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

      const history = await onboardingService.getAuditHistory(app.id);
      return res.status(200).json({ success: true, application: app, history });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/onboarding/applications/:id/verify-document
  async verifyDocument(req, res) {
    try {
      const appId = req.params.id;
      const b = req.body || {};
      const docId = b.docId || b.documentId || b.document_id;
      const verificationStatus = b.verificationStatus || b.verification_status || 'Verified';
      const hrRemarks = b.hrRemarks || b.hr_remarks || b.remarks || '';
      const hrUser = req.hrUser ? (req.hrUser.name || req.hrUser.email || 'HR Lead') : 'HR Lead';

      const doc = await onboardingService.verifyDocument(appId, docId, {
        verificationStatus,
        hrRemarks,
        hrUser
      });

      return res.status(200).json({
        success: true,
        message: `Document status updated to ${verificationStatus}.`,
        document: doc
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/onboarding/applications/:id/request-correction
  async requestCorrection(req, res) {
    try {
      const appId = req.params.id;
      const { affectedFields, affectedDocuments, remarks } = req.body || {};
      const hrUser = req.hrUser ? (req.hrUser.name || req.hrUser.email || 'HR Lead') : 'HR Lead';

      const updated = await onboardingService.requestCorrection(appId, {
        affectedFields: affectedFields || [],
        affectedDocuments: affectedDocuments || [],
        remarks,
        hrUser
      });

      return res.status(200).json({
        success: true,
        message: 'Correction request submitted and applicant notified.',
        application: updated
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/onboarding/applications/:id/approve
  async approveApplication(req, res) {
    try {
      const appId = req.params.id;
      const { hrNotes } = req.body || {};
      const hrUser = req.hrUser ? (req.hrUser.name || req.hrUser.email || 'HR Lead') : 'HR Lead';

      const approved = await onboardingService.approveApplication(appId, {
        hrUser,
        hrNotes
      });

      return res.status(200).json({
        success: true,
        message: 'Onboarding application approved successfully!',
        application: approved
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/onboarding/applications/:id/reject
  async rejectApplication(req, res) {
    try {
      const appId = req.params.id;
      const { rejectionReason } = req.body || {};
      const hrUser = req.hrUser ? (req.hrUser.name || req.hrUser.email || 'HR Lead') : 'HR Lead';

      const rejected = await onboardingService.rejectApplication(appId, {
        rejectionReason,
        hrUser
      });

      return res.status(200).json({
        success: true,
        message: 'Application marked as Rejected.',
        application: rejected
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/hr/onboarding/applications/:id/history
  async getAuditHistory(req, res) {
    try {
      const appId = req.params.id;
      const history = await onboardingService.getAuditHistory(appId);
      return res.status(200).json({ success: true, history });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new OnboardingController();

