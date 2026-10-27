/**
 * PUVIMA Consultancy — Admin Controller
 * Handles authentication, inquiries review, bookings management, and main-page settings.
 */

const { signToken } = require('../utils/token');
const storeService = require('../services/store.service');

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@puvima.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

class AdminController {
  
  // POST /api/admin/login
  async login(req, res) {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required for admin authentication.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const allowedEmails = [DEFAULT_ADMIN_EMAIL.toLowerCase(), 'puvimaconsultancy@gmail.com', 'admin@puvima.com'];
    if (!allowedEmails.includes(cleanEmail) || cleanPass !== DEFAULT_ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials. Please verify and re-try.'
      });
    }

    const token = signToken({
      email: cleanEmail,
      role: 'admin',
      name: 'PUVIMA Administrator'
    });

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful.',
      token,
      user: {
        email: cleanEmail,
        role: 'admin',
        name: 'PUVIMA Administrator'
      }
    });
  }

  // GET /api/admin/me
  async getMe(req, res) {
    return res.status(200).json({
      success: true,
      user: req.admin
    });
  }

  // GET /api/admin/stats
  async getStats(req, res) {
    try {
      const stats = await storeService.getDashboardStats();
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error computing administrative metrics: ' + err.message
      });
    }
  }

  // GET /api/admin/contacts
  async getContacts(req, res) {
    try {
      const { status, search } = req.query;
      const contacts = await storeService.getContacts({ status, search });
      return res.status(200).json({
        success: true,
        count: contacts.length,
        contacts
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact inquiries: ' + err.message
      });
    }
  }

  // PATCH /api/admin/contacts/:id
  async updateContact(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;
      const updated = await storeService.updateContactStatus(id, { status, admin_notes });
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Contact inquiry not found.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Contact inquiry status updated.',
        contact: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update contact inquiry: ' + err.message
      });
    }
  }

  // DELETE /api/admin/contacts/:id
  async deleteContact(req, res) {
    try {
      const { id } = req.params;
      await storeService.deleteContact(id);
      return res.status(200).json({
        success: true,
        message: 'Contact inquiry removed successfully.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete contact inquiry: ' + err.message
      });
    }
  }

  // GET /api/admin/bookings
  async getBookings(req, res) {
    try {
      const { status, search } = req.query;
      const bookings = await storeService.getBookings({ status, search });
      return res.status(200).json({
        success: true,
        count: bookings.length,
        bookings
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve consultation bookings: ' + err.message
      });
    }
  }

  // PATCH /api/admin/bookings/:id
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes, preferred_date, preferred_time } = req.body;
      const updated = await storeService.updateBookingStatus(id, {
        status,
        admin_notes,
        preferred_date,
        preferred_time
      });
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Consultation booking not found.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Consultation booking updated.',
        booking: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update booking: ' + err.message
      });
    }
  }

  // DELETE /api/admin/bookings/:id
  async deleteBooking(req, res) {
    try {
      const { id } = req.params;
      await storeService.deleteBooking(id);
      return res.status(200).json({
        success: true,
        message: 'Consultation booking removed successfully.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete booking: ' + err.message
      });
    }
  }

  // GET /api/admin/settings
  async getSettings(req, res) {
    try {
      const settings = await storeService.getSettings();
      return res.status(200).json({
        success: true,
        settings
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve site settings: ' + err.message
      });
    }
  }

  // PUT /api/admin/settings
  async updateSettings(req, res) {
    try {
      const updated = await storeService.updateSettings(req.body);
      return res.status(200).json({
        success: true,
        message: 'Main page configuration saved successfully.',
        settings: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save site settings: ' + err.message
      });
    }
  }

  // GET /api/admin/reviews
  async getReviews(req, res) {
    try {
      const { status, search } = req.query;
      const reviews = await storeService.getReviews({ status, search });
      return res.status(200).json({
        success: true,
        count: reviews.length,
        reviews
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve reviews: ' + err.message
      });
    }
  }

  // PATCH /api/admin/reviews/:id
  async updateReview(req, res) {
    try {
      const { id } = req.params;
      const { status, avatar_url } = req.body;
      const updated = await storeService.updateReviewStatus(id, { status, avatar_url });
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Review record not found.'
        });
      }
      return res.status(200).json({
        success: true,
        message: status === 'approved' ? 'Review approved and pushed to main page!' : 'Review status updated.',
        review: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update review status: ' + err.message
      });
    }
  }

  // DELETE /api/admin/reviews/:id
  async deleteReview(req, res) {
    try {
      const { id } = req.params;
      await storeService.deleteReview(id);
      return res.status(200).json({
        success: true,
        message: 'Review removed successfully.'
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete review: ' + err.message
      });
    }
  }
}

module.exports = new AdminController();
