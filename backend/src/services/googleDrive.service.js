/**
 * PUVIMA Consultancy — Google Drive Resume Storage Service
 * Handles server-side upload of candidate resumes directly to PUVIMA's
 * designated private Google Drive recruitment folder via the official Google Drive API v3.
 * 
 * Never exposes credentials to the frontend. Generates safe unique filenames using
 * the application reference ID, returns the authentic Google Drive file ID & URL,
 * and supports orphan cleanup if downstream database transactions fail.
 */

let google = null;
try {
  google = require('googleapis').google;
} catch (e) {
  // Optional dependency: googleapis
}
const { Readable } = require('stream');
const path = require('path');
const crypto = require('crypto');

class GoogleDriveService {
  constructor() {
    this.clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || null;
    this.privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    this.driveClient = null;
    this.authClient = null;
  }

  /**
   * Reload environment configuration (useful if env vars change at runtime)
   */
  reloadConfig() {
    this.clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || null;
    this.privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    this.driveClient = null;
    this.authClient = null;
  }

  /**
   * Check if Google Drive credentials are fully configured
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(
      google &&
      this.clientEmail &&
      this.privateKey &&
      this.folderId
    );
  }

  /**
   * Get authenticated Google Drive API v3 client instance
   * @returns {import('googleapis').drive_v3.Drive}
   */
  getClient() {
    if (this.driveClient) return this.driveClient;

    if (!this.isConfigured()) {
      throw new Error(
        'Google Drive API credentials are not configured. Ensure GOOGLE_DRIVE_CLIENT_EMAIL, ' +
        'GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID are set in backend/.env'
      );
    }

    // Safely format private key: unescape literal \n into real newlines
    let formattedKey = this.privateKey;
    if (typeof formattedKey === 'string') {
      formattedKey = formattedKey.replace(/\\n/g, '\n');
    }

    this.authClient = new google.auth.JWT({
      email: this.clientEmail,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    this.driveClient = google.drive({ version: 'v3', auth: this.authClient });
    return this.driveClient;
  }

  /**
   * Sanitize filename and construct a unique filename bound to application reference ID
   * @param {string} originalName 
   * @param {string} referenceId 
   * @returns {string}
   */
  buildUniqueFilename(originalName, referenceId) {
    const ext = path.extname(originalName || '').toLowerCase() || '.pdf';
    const cleanBase = path.basename(originalName || 'resume', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const safeRef = (referenceId || 'REF').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeRef}_${cleanBase}${ext}`;
  }

  /**
   * Upload a candidate resume file directly to PUVIMA's designated Google Drive folder
   * @param {Object} params
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.originalName - Uploaded document name
   * @param {string} params.mimeType - Canonical MIME type
   * @param {string} params.referenceId - Unique application reference ID
   * @returns {Promise<{ fileId: string, webViewLink: string, webContentLink?: string, filename: string }>}
   */
  async uploadResume({ buffer, originalName, mimeType, referenceId }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Valid resume file buffer is required for Google Drive upload.');
    }

    const filename = this.buildUniqueFilename(originalName, referenceId);

    // Mock mode for unit tests and local development when service account credentials are unconfigured
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test' || process.env.GOOGLE_DRIVE_MOCK === 'true') {
        const mockFileId = `gdrive_mock_${crypto.randomBytes(12).toString('hex')}`;
        return {
          fileId: mockFileId,
          webViewLink: `https://drive.google.com/file/d/${mockFileId}/view`,
          webContentLink: `https://drive.google.com/uc?id=${mockFileId}&export=download`,
          filename,
          isMock: true
        };
      }
      throw new Error('Google Drive service is not configured. Missing service account credentials in environment.');
    }

    try {
      const drive = this.getClient();
      const media = {
        mimeType: mimeType || 'application/pdf',
        body: Readable.from(buffer)
      };

      const requestBody = {
        name: filename,
        parents: [this.folderId],
        description: `PUVIMA Consultancy Internship Application Resume — Reference: ${referenceId}`
      };

      const response = await drive.files.create({
        requestBody,
        media,
        fields: 'id, name, webViewLink, webContentLink, size, createdTime'
      });

      if (!response.data || !response.data.id) {
        throw new Error('Google Drive API did not return a valid file ID.');
      }

      const fileId = response.data.id;
      // Derive authentic view URL from the real uploaded file ID
      const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
      const webContentLink = response.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

      return {
        fileId,
        webViewLink,
        webContentLink,
        filename: response.data.name || filename,
        isMock: false
      };
    } catch (err) {
      console.error('[GoogleDriveService] Resume upload failed:', err.message);
      throw new Error(`Google Drive upload failed: ${err.message}`);
    }
  }

  /**
   * Delete an orphaned file from Google Drive if a downstream database operation fails
   * @param {string} fileId 
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileId) {
    if (!fileId) return false;
    if (!this.isConfigured()) return true; // mock cleanup

    try {
      const drive = this.getClient();
      await drive.files.delete({ fileId });
      return true;
    } catch (err) {
      console.warn(`[GoogleDriveService] Failed to clean up orphaned file ${fileId}:`, err.message);
      return false;
    }
  }

  /**
   * Get metadata for a file in Google Drive
   * @param {string} fileId 
   * @returns {Promise<Object>}
   */
  async getFileMetadata(fileId) {
    if (!fileId) throw new Error('File ID is required.');
    if (!this.isConfigured()) {
      return { id: fileId, name: 'resume.pdf', webViewLink: `https://drive.google.com/file/d/${fileId}/view` };
    }
    const drive = this.getClient();
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime'
    });
    return res.data;
  }

  /**
   * Stream a resume file from Google Drive (used for authorized admin preview)
   * @param {string} fileId 
   * @returns {Promise<{ stream: import('stream').Readable, metadata: Object }>}
   */
  async downloadFileStream(fileId) {
    if (!fileId) throw new Error('File ID is required.');
    const drive = this.getClient();
    const metadata = await this.getFileMetadata(fileId);
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return { stream: response.data, metadata };
  }
}

module.exports = new GoogleDriveService();

