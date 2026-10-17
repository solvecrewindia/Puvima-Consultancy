

const express = require('express');
const router = express.Router();
const { formRateLimiter } = require('../middleware/rateLimiter');
const { validateBookingRequest } = require('../middleware/validateRequest');
const { submitBooking } = require('../controllers/booking.controller');

router.post('/bookings', formRateLimiter, validateBookingRequest, submitBooking);

module.exports = router;
