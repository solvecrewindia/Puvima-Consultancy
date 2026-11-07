/**
 * PUVIMA Consultancy — Internship Applications Routes
 * Public candidate submission, HR Portal management, and Super Admin oversight.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const internshipController = require('../controllers/internship.controller');
const { requireHrOrAdmin, requireSuperAdminOrAdmin } = require('../middleware/portalAuth');

const MAX_RESUME_SIZE = parseInt(process.env.MAX_RESUME_SIZE_BYTES, 10) || 5 * 1024 * 1024;

// Memory storage to validate buffer in-memory and write to local storage / Drive
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_SIZE,
    files: 1
  }
});

// Middleware to accept resume uploaded under 'resume', 'file', or 'cv'
function uploadResumeMiddleware(req, res, next) {
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'cv', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = Math.round(MAX_RESUME_SIZE / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `Resume file exceeds maximum allowed size of ${mb}MB. Please compress or select a smaller document.`
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: `Upload failed: ${err.message}`
      });
    }

    // Attach single file to req.file
    if (req.files) {
      if (req.files.resume && req.files.resume[0]) req.file = req.files.resume[0];
      else if (req.files.file && req.files.file[0]) req.file = req.files.file[0];
      else if (req.files.cv && req.files.cv[0]) req.file = req.files.cv[0];
    }

    next();
  });
}

// Rate limiter for public applications
const internshipRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 30,
  message: {
    success: false,
    message: 'Too many internship applications submitted from this network. Please wait a few minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ----------------------------------------------------------------------------
// Public Endpoint
// ----------------------------------------------------------------------------
router.post('/internship-applications', internshipRateLimiter, uploadResumeMiddleware, (req, res) =>
  internshipController.submitApplication(req, res)
);

// ----------------------------------------------------------------------------
// HR Portal Endpoints (Accessible by HR, Admin, SuperAdmin)
// ----------------------------------------------------------------------------
router.get('/hr/internship-applications', requireHrOrAdmin, (req, res) =>
  internshipController.getApplications(req, res)
);

router.get('/hr/internship-applications/stats', requireHrOrAdmin, (req, res) =>
  internshipController.getStats(req, res)
);

router.get('/hr/internship-applications/:id', requireHrOrAdmin, (req, res) =>
  internshipController.getApplicationById(req, res)
);

router.patch('/hr/internship-applications/:id/status', requireHrOrAdmin, (req, res) =>
  internshipController.updateApplicationStatus(req, res)
);

router.patch('/hr/internship-applications/:id/reviewed', requireHrOrAdmin, (req, res) =>
  internshipController.markReviewedByHr(req, res)
);

router.get('/hr/internship-applications/:id/resume', requireHrOrAdmin, (req, res) =>
  internshipController.getApplicationResume(req, res)
);

// ----------------------------------------------------------------------------
// Super Admin Endpoints (Accessible by SuperAdmin and Admin)
// ----------------------------------------------------------------------------
router.get('/admin/internship-applications', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.getApplications(req, res)
);

router.get('/admin/internship-applications/stats', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.getStats(req, res)
);

router.get('/admin/internship-applications/:id', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.getApplicationById(req, res)
);

router.patch('/admin/internship-applications/:id/status', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.updateApplicationStatus(req, res)
);

router.get('/admin/internship-applications/:id/history', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.getApplicationHistory(req, res)
);

router.get('/admin/internship-applications/:id/resume', requireSuperAdminOrAdmin, (req, res) =>
  internshipController.getApplicationResume(req, res)
);

module.exports = router;
