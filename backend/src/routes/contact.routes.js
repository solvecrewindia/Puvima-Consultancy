

const express = require('express');
const router = express.Router();
const { formRateLimiter } = require('../middleware/rateLimiter');
const { validateContactRequest } = require('../middleware/validateRequest');
const { submitContact } = require('../controllers/contact.controller');

router.post('/contact', formRateLimiter, validateContactRequest, submitContact);

module.exports = router;
