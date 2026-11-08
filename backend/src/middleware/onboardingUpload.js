/**
 * PUVIMA Consultancy — Onboarding Document Upload Middleware
 * Supports PDF, JPG, JPEG, and PNG document uploads with validation and secure storage.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BASE_UPLOAD_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'puvima-onboarding-docs')
  : path.resolve(__dirname, '../../uploads/onboarding');

try {
  if (!fs.existsSync(BASE_UPLOAD_DIR)) {
    fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
  }
} catch (e) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const appId = req.params.id || req.body.application_id || 'temp';
    const appDir = path.join(BASE_UPLOAD_DIR, appId.replace(/[^a-zA-Z0-9_-]/g, ''));
    try {
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }
    } catch (e) {}
    cb(null, appDir);
  },
  filename: function (req, file, cb) {
    const category = (req.body.category || 'doc').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const rand = crypto.randomBytes(6).toString('hex');
    const safeName = `${category}_${rand}_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are supported.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 5
  }
});

module.exports = upload;

