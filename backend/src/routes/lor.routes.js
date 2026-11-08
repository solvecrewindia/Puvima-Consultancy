/**
 * PUVIMA Consultancy — Letter of Recommendation (LOR) Routes
 */

const express = require('express');
const router = express.Router();
const lorController = require('../controllers/lor.controller');

// Intern LOR management
router.post('/lor/request', lorController.submitLorRequest);
router.get('/lor/my', lorController.getMyLor);
router.post('/lor/:id/resend-email', lorController.resendEmail);

// Professor Verification & Endorsement (Public token-authenticated)
router.get('/lor/verify/:token', lorController.getByToken);
router.post('/lor/confirm/:token', lorController.confirmByProfessor);
router.post('/lor/decline/:token', lorController.declineByProfessor);

// Download PDF
router.get('/lor/:id/pdf', lorController.generatePdf);

// HR LOR Management
router.get('/hr/lor/requests', lorController.getHrRequests);
router.get('/hr/lor/stats', lorController.getHrStats);
router.post('/hr/lor/:id/approve', lorController.approveByHr);
router.post('/hr/lor/:id/reject', lorController.rejectByHr);

module.exports = router;

