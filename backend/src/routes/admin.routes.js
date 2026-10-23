/**
 * PUVIMA Consultancy — Admin API Routes
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminAuth = require('../middleware/adminAuth');

// Public admin authentication endpoint
router.post('/admin/login', (req, res) => adminController.login(req, res));

// Protected admin endpoints
router.get('/admin/me', adminAuth, (req, res) => adminController.getMe(req, res));
router.get('/admin/stats', adminAuth, (req, res) => adminController.getStats(req, res));

// Contacts review & management
router.get('/admin/contacts', adminAuth, (req, res) => adminController.getContacts(req, res));
router.patch('/admin/contacts/:id', adminAuth, (req, res) => adminController.updateContact(req, res));
router.delete('/admin/contacts/:id', adminAuth, (req, res) => adminController.deleteContact(req, res));

// Bookings review & management
router.get('/admin/bookings', adminAuth, (req, res) => adminController.getBookings(req, res));
router.patch('/admin/bookings/:id', adminAuth, (req, res) => adminController.updateBooking(req, res));
router.delete('/admin/bookings/:id', adminAuth, (req, res) => adminController.deleteBooking(req, res));

// Main page configuration
router.get('/admin/settings', adminAuth, (req, res) => adminController.getSettings(req, res));
router.put('/admin/settings', adminAuth, (req, res) => adminController.updateSettings(req, res));

// Customer reviews moderation & push-to-main-page
router.get('/admin/reviews', adminAuth, (req, res) => adminController.getReviews(req, res));
router.patch('/admin/reviews/:id', adminAuth, (req, res) => adminController.updateReview(req, res));
router.delete('/admin/reviews/:id', adminAuth, (req, res) => adminController.deleteReview(req, res));

// Careers & Recruitment management
const careersController = require('../controllers/careers.controller');

router.get('/admin/careers', adminAuth, (req, res) => careersController.getAllPositionsAdmin(req, res));
router.post('/admin/careers', adminAuth, (req, res) => careersController.createPositionAdmin(req, res));
router.put('/admin/careers/:id', adminAuth, (req, res) => careersController.updatePositionAdmin(req, res));
router.patch('/admin/careers/:id/status', adminAuth, (req, res) => careersController.updatePositionStatusAdmin(req, res));
router.delete('/admin/careers/:id', adminAuth, (req, res) => careersController.deletePositionAdmin(req, res));

// Candidate applications management
router.get('/admin/applications', adminAuth, (req, res) => careersController.getApplicationsAdmin(req, res));
router.get('/admin/applications/:id', adminAuth, (req, res) => careersController.getApplicationByIdAdmin(req, res));
router.patch('/admin/applications/:id/status', adminAuth, (req, res) => careersController.updateApplicationStatusAdmin(req, res));
router.get('/admin/applications/:id/resume', adminAuth, (req, res) => careersController.getApplicationResumeAdmin(req, res));

module.exports = router;

