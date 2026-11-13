/**
 * Puvima IT Service and Research Consultancy — User Management API Controller
 */

const userService = require('../services/userService');

class UserController {
  async getUsers(req, res) {
    try {
      const users = await userService.getAllProfiles(req.query);
      return res.json({
        success: true,
        users,
        total: users.length
      });
    } catch (err) {
      console.error('[UserController] getUsers error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async createUser(req, res) {
    try {
      const created = await userService.createProfile(req.body);
      return res.status(201).json({
        success: true,
        message: `Account profile created successfully. Assigned code: ${created.user_code}`,
        user: created
      });
    } catch (err) {
      console.warn('[UserController] createUser notice:', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const updated = await userService.toggleActive(id);
      return res.json({
        success: true,
        message: `User ${updated.user_code} status updated to ${updated.is_active ? 'Active' : 'Inactive'}`,
        user: updated
      });
    } catch (err) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }
}

module.exports = new UserController();

