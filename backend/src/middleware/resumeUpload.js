/**
 * PUVIMA Consultancy — Secure Resume Upload Middleware
 * Validates resume file uploads: extension, MIME type, magic bytes signature, and size limit.
 * Stores resumes securely outside the public web root with unguessable cryptographic filenames.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const RESUMES_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'puvima-resumes')
  : path.resolve(__dirname, '../../uploads/resumes');
try {
  if (!fs.existsSync(RESUMES_DIR)) {
    fs.mkdirSync(RESUMES_DIR, { recursive: true });
  }
} catch (err) {
  // Gracefully continue in serverless read-only environments
}

const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_RESUME_SIZE_BYTES, 10) || 5 * 1024 * 1024; // 5 MB

// Allowed formats and their magic numbers
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream' // Browsers occasionally send octet-stream for docx
];

/**
 * Validate magic numbers against known document signatures
 * @param {Buffer} buffer 
 * @param {string} ext 
 * @returns {boolean}
 */
function validateMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  // PDF signature: starts with %PDF (0x25 0x50 0x44 0x46)
  if (ext === '.pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // DOC (legacy Microsoft Compound File Binary): 0xD0 0xCF 0x11 0xE0
  if (ext === '.doc') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    );
  }

  // DOCX (Zip archive PK): 0x50 0x4B 0x03 0x04
  if (ext === '.docx') {
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  return false;
}

// Memory storage so we can validate magic bytes and size before touching disk
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1
  }
}).single('resume');

function handleResumeUpload(req, res, next) {
  memoryUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'A resume document (PDF, DOC, or DOCX) is required to submit an application.'
      });
    }

    const file = req.file;
    const rawExt = path.extname(file.originalname || '').toLowerCase();

    // 1. Verify Extension
    if (!ALLOWED_EXTENSIONS.includes(rawExt)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported resume file type. Only PDF (.pdf) and Word documents (.doc, .docx) are accepted.'
      });
    }

    // 2. Verify MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resume file MIME format.'
      });
    }

    // 3. Verify Magic Bytes
    if (!validateMagicBytes(file.buffer, rawExt)) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contents do not match its declared document format. Executables and invalid documents are strictly prohibited.'
      });
    }

    // 4. Sanitize original filename for user reference
    const sanitizedOriginalName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 150);

    // 5. Generate secure server-side storage filename
    const randomHex = crypto.randomBytes(16).toString('hex');
    const storageKey = `resume_${randomHex}_${Date.now()}${rawExt}`;
    const destinationPath = path.join(RESUMES_DIR, storageKey);

    try {
      fs.writeFileSync(destinationPath, file.buffer);
    } catch (fsErr) {
      console.error('[ResumeUpload] Failed to persist resume to disk:', fsErr.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to securely persist uploaded resume document.'
      });
    }

    // Normalize canonical MIME type
    let canonicalMime = file.mimetype;
    if (rawExt === '.pdf') canonicalMime = 'application/pdf';
    else if (rawExt === '.doc') canonicalMime = 'application/msword';
    else if (rawExt === '.docx') canonicalMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    req.resumeData = {
      originalName: sanitizedOriginalName,
      storageKey,
      mimeType: canonicalMime,
      sizeBytes: file.size,
      absolutePath: destinationPath
    };

    next();
  });
}

module.exports = {
  handleResumeUpload,
  RESUMES_DIR,
  MAX_UPLOAD_BYTES,
  validateMagicBytes
};
