/**
 * Puvima IT Service and Research Consultancy — Onboarding & HR Verification Routes
 */

const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboarding.controller');
const upload = require('../middleware/onboardingUpload');
const { requireHrRole, requireApplicantAccess } = require('../middleware/onboardingAuth');

// ============================================================================
// APPLICANT ONBOARDING ROUTES
// ============================================================================

// Initialize or resume onboarding application
router.post('/onboarding/init', onboardingController.initApplication);

// Get application draft / details
router.get('/onboarding/:id', requireApplicantAccess, onboardingController.getApplication);

// Save step data (Steps 1 to 7)
router.put('/onboarding/:id/step/:stepNumber', requireApplicantAccess, onboardingController.saveStep);

// Upload a supporting document (Step 8)
router.post(
  '/onboarding/:id/document',
  requireApplicantAccess,
  upload.single('file'),
  onboardingController.uploadDocument
);

// Delete an uploaded document
router.delete(
  '/onboarding/:id/document/:docId',
  requireApplicantAccess,
  onboardingController.deleteDocument
);

// Preview or download uploaded document (secure stream)
router.get('/onboarding/:id/document/:docId', onboardingController.serveDocument);

// Final Application Submission (Step 10)
router.post('/onboarding/:id/submit', requireApplicantAccess, onboardingController.submitApplication);

// Resubmit application after HR requested corrections
router.post('/onboarding/:id/resubmit', requireApplicantAccess, onboardingController.resubmitCorrections);

// Generate / stream official PUVIMA Onboarding Application PDF
router.get('/onboarding/:id/pdf', onboardingController.generatePdf);

// Public status tracking (supports /api/onboarding/:id/status and /api/onboarding/status/:id)
router.get(['/onboarding/:id/status', '/onboarding/status/:id'], onboardingController.getStatus);


// ============================================================================
// HR ONBOARDING VERIFICATION ROUTES (Restricted to HR / Admin roles)
// ============================================================================

// List onboarding applications with search, filter, pagination
router.get('/hr/onboarding/applications', requireHrRole, onboardingController.getHrApplications);

// Summary metrics (Total, New, Under Review, Correction Required, Approved, Rejected)
router.get('/hr/onboarding/stats', requireHrRole, onboardingController.getHrStats);

// Get detailed application for HR verification (unmasked bank info for authorized HR)
router.get(['/hr/onboarding/applications/:id', '/hr/onboarding/:id'], requireHrRole, onboardingController.getHrApplicationDetails);

// Verify an individual document (Verified / Invalid / Correction Required)
router.post(['/hr/onboarding/applications/:id/verify-document', '/hr/onboarding/:id/verify-document'], requireHrRole, onboardingController.verifyDocument);

// Request corrections from applicant
router.post(['/hr/onboarding/applications/:id/request-correction', '/hr/onboarding/:id/request-correction'], requireHrRole, onboardingController.requestCorrection);

// Final HR approval
router.post(['/hr/onboarding/applications/:id/approve', '/hr/onboarding/:id/approve'], requireHrRole, onboardingController.approveApplication);

// Final HR rejection
router.post(['/hr/onboarding/applications/:id/reject', '/hr/onboarding/:id/reject'], requireHrRole, onboardingController.rejectApplication);

// Full audit history timeline
router.get('/hr/onboarding/applications/:id/history', requireHrRole, onboardingController.getAuditHistory);

module.exports = router;

