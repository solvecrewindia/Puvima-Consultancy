/**
 * PUVIMA Consultancy — Company User Management Routes
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// Allow querying users for authenticated portal sessions or internal views
router.get(['/company/users', '/admin/users'], (req, res) => userController.getUsers(req, res));
router.post(['/company/users', '/admin/users'], (req, res) => userController.createUser(req, res));
router.patch(['/company/users/:id/toggle', '/admin/users/:id/toggle'], (req, res) => userController.toggleStatus(req, res));

module.exports = router;
