


const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Sanitize plain string input: trim and strip potential control chars.
 * @param {string} val
 * @returns {string}
 */
function sanitizeString(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
}

/**
 * Validate Contact Form Submissions
 */
function validateContactRequest(req, res, next) {
  const errors = [];
  const body = req.body || {};

  const name = sanitizeString(body.name);
  const email = sanitizeString(body.email).toLowerCase();
  const company = sanitizeString(body.company);
  const subject = sanitizeString(body.subject);
  const message = sanitizeString(body.message);

  if (!name || name.length < 2 || name.length > 128) {
    errors.push('Name is required and must be between 2 and 128 characters.');
  }

  if (!email || !EMAIL_REGEX.test(email) || email.length > 255) {
    errors.push('A valid corporate work email is required.');
  }

  if (company && company.length > 128) {
    errors.push('Company name cannot exceed 128 characters.');
  }

  if (subject && subject.length > 255) {
    errors.push('Subject cannot exceed 255 characters.');
  }

  if (!message || message.length < 5 || message.length > 4000) {
    errors.push('Message is required and must be between 5 and 4000 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the indicated errors.',
      errors
    });
  }

  req.sanitized = {
    name,
    email,
    company: company || null,
    subject: subject || null,
    message
  };

  next();
}

/**
 * Validate Consultation Booking Requests
 */
function validateBookingRequest(req, res, next) {
  const errors = [];
  const body = req.body || {};

  const name = sanitizeString(body.name);
  const email = sanitizeString(body.email).toLowerCase();
  const company = sanitizeString(body.company);
  const topic = sanitizeString(body.topic);
  const preferredDate = sanitizeString(body.preferredDate || body.preferred_date);
  const preferredTime = sanitizeString(body.preferredTime || body.preferred_time);
  const meetingFormat = sanitizeString(body.meetingFormat || body.meeting_format) || 'Virtual Video Session (Zoom / Meet)';
  const message = sanitizeString(body.message || body.notes);

  if (!name || name.length < 2 || name.length > 128) {
    errors.push('Full name is required and must be between 2 and 128 characters.');
  }

  if (!email || !EMAIL_REGEX.test(email) || email.length > 255) {
    errors.push('A valid business email is required.');
  }

  if (company && company.length > 128) {
    errors.push('Company name cannot exceed 128 characters.');
  }

  if (!topic || topic.length < 2 || topic.length > 255) {
    errors.push('Please select a valid consultation topic.');
  }

  if (!preferredDate) {
    errors.push('Preferred consultation date is required.');
  } else {
    const parsedDate = new Date(preferredDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Preferred date must be a valid date in YYYY-MM-DD format.');
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate < today) {
        errors.push('Preferred date cannot be in the past.');
      }
    }
  }

  if (!preferredTime || preferredTime.length > 64) {
    errors.push('Please select a preferred consultation time window.');
  }

  if (meetingFormat.length > 64) {
    errors.push('Meeting format descriptor exceeds allowable length.');
  }

  if (message && message.length > 4000) {
    errors.push('Project context message cannot exceed 4000 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the indicated errors.',
      errors
    });
  }

  req.sanitized = {
    name,
    email,
    company: company || null,
    topic,
    preferredDate,
    preferredTime,
    meetingFormat,
    message: message || null
  };

  next();
}

module.exports = {
  validateContactRequest,
  validateBookingRequest
};
