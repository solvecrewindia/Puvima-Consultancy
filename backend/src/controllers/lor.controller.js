/**
 * PUVIMA Consultancy — Letter of Recommendation (LOR) Controller
 * Orchestrates intern LOR submission, professor email verification,
 * professor endorsement confirmation, and HR approval.
 */

const lorService = require('../services/lor.service');
const lorPdfService = require('../services/lorPdf.service');

class LorController {
  // POST /api/lor/request
  async submitLorRequest(req, res) {
    try {
      const internUser = {
        id: (req.user && req.user.id) || null,
        email: (req.user && req.user.email) || req.body.intern_email,
        name: (req.user && req.user.name) || req.body.intern_name,
        phone: (req.user && req.user.phone) || req.body.intern_phone
      };

      if (!internUser.email) {
        return res.status(400).json({ success: false, message: 'Intern email address is required.' });
      }

      const lor = await lorService.submitLorRequest(internUser, req.body);

      // Automatically dispatch email to professor
      const hostOrigin = `${req.protocol}://${req.get('host')}`;
      const emailResult = await lorService.sendProfessorVerificationEmail(lor.id, hostOrigin);

      return res.status(200).json({
        success: true,
        message: 'LOR application submitted and verification email sent to professor.',
        lor,
        email_result: emailResult
      });
    } catch (err) {
      console.error('[LorController] submitLorRequest error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/lor/my
  async getMyLor(req, res) {
    try {
      const email = req.query.email || (req.user && req.user.email);
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email query parameter required.' });
      }

      const lor = await lorService.getLorByInternEmail(email);
      return res.status(200).json({
        success: true,
        lor: lor || null
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/lor/:id/resend-email
  async resendEmail(req, res) {
    try {
      const lorId = req.params.id;
      const hostOrigin = `${req.protocol}://${req.get('host')}`;
      const result = await lorService.sendProfessorVerificationEmail(lorId, hostOrigin);

      return res.status(200).json({
        success: true,
        message: 'Verification email resent to professor successfully.',
        result
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/lor/verify/:token (Public endpoint for Professor Confirmation Page)
  async getByToken(req, res) {
    try {
      const token = req.params.token;
      const lor = await lorService.getLorByToken(token);
      return res.status(200).json({
        success: true,
        lor
      });
    } catch (err) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  // POST /api/lor/confirm/:token (Professor Endorsement Action)
  async confirmByProfessor(req, res) {
    try {
      const token = req.params.token;
      const { remarks, rating } = req.body || {};
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const result = await lorService.confirmByProfessor(token, { remarks, rating, ipAddress });
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/lor/decline/:token (Professor Decline Action)
  async declineByProfessor(req, res) {
    try {
      const token = req.params.token;
      const { reason } = req.body || {};
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const result = await lorService.declineByProfessor(token, { reason, ipAddress });
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // GET /api/lor/:id/pdf (Download official PUVIMA LOR PDF)
  async generatePdf(req, res) {
    try {
      const id = req.params.id;
      const store = lorService.readLocalStore();
      const lor = store.requests.find(r => r.id === id || r.lor_request_id === id);
      if (!lor) {
        return res.status(404).json({ success: false, message: 'LOR request not found.' });
      }

      const pdfBuffer = await lorPdfService.generatePdfBuffer(lor);
      const filename = `PUVIMA_LOR_${lor.lor_request_id || 'Document'}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('[LorController] PDF error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate LOR document: ' + err.message });
    }
  }

  // --- HR MANAGEMENT ENDPOINTS ---

  // GET /api/hr/lor/requests
  async getHrRequests(req, res) {
    try {
      const { search, status, page, limit } = req.query;
      const result = await lorService.getHrLorRequests({ search, status, page, limit });
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/hr/lor/stats
  async getHrStats(req, res) {
    try {
      const stats = await lorService.getHrStats();
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/lor/:id/approve
  async approveByHr(req, res) {
    try {
      const id = req.params.id;
      const hrUser = req.hrUser || req.user || { name: 'HR Lead' };
      const { hrRemarks } = req.body || {};

      const approved = await lorService.approveByHr(id, hrUser, { hrRemarks });
      return res.status(200).json({
        success: true,
        message: 'LOR approved and officially issued by HR.',
        lor: approved
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /api/hr/lor/:id/reject
  async rejectByHr(req, res) {
    try {
      const id = req.params.id;
      const hrUser = req.hrUser || req.user || { name: 'HR Lead' };
      const { hrRemarks } = req.body || {};

      const rejected = await lorService.rejectByHr(id, hrUser, { hrRemarks });
      return res.status(200).json({
        success: true,
        message: 'LOR request rejected by HR.',
        lor: rejected
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new LorController();

