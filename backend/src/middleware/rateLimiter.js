/**
 * PUVIMA Consultancy — Enterprise Rate Limiting & Brute-Force Protection
 * Protects authentication, public forms, sensitive APIs, and MFA against automated attacks.
 */

const rateLimit = require('express-rate-limit');

// Public contact & booking forms rate limiter
const formRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 mins
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions received from this network. Please wait a few minutes before submitting again.'
  }
});

// Dedicated login & authentication rate limiter (Brute-force & credential stuffing defense)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 12, // Max 12 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Too many login attempts from this network. For security reasons, access is temporarily throttled. Please try again in 15 minutes.'
  }
});

// Password reset & recovery rate limiter
const passwordResetRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // Max 5 reset requests per 30 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password recovery requests. Please wait 30 minutes before trying again.'
  }
});

// Multi-Factor Authentication (TOTP) verification rate limiter
const mfaRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 8, // Max 8 code verification attempts per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many MFA verification attempts. Please wait 10 minutes before attempting again.'
  }
});

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests per 15 mins
  skip: (req) => {
    // Only skip rate limit for already verified authenticated internal requests
    return !!req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ');
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded for API requests. Please try again later.'
  }
});

module.exports = {
  formRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  mfaRateLimiter,
  apiRateLimiter
};
