/**
 * PUVIMA Consultancy — Public Careers API Routes
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const careersController = require('../controllers/careers.controller');
const { handleResumeUpload } = require('../middleware/resumeUpload');

const applicationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: {
    success: false,
    message: 'Too many candidate application submissions from this network. Please wait before submitting again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// GET /api/careers — list published open positions
router.get('/careers', (req, res) => careersController.getPublishedPositions(req, res));

// GET /api/careers/:id — retrieve published position details
router.get('/careers/:id', (req, res) => careersController.getPositionById(req, res));

// POST /api/careers/:id/apply — submit application and resume
router.post('/careers/:id/apply', applicationRateLimiter, handleResumeUpload, (req, res) =>
  careersController.applyForPosition(req, res)
);

module.exports = router;
