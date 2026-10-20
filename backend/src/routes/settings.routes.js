/**
 * PUVIMA Consultancy — Public Site Settings Route
 */

const express = require('express');
const router = express.Router();
const storeService = require('../services/store.service');

// GET /api/site-settings
router.get('/site-settings', (req, res) => {
  const settings = storeService.getSettings();
  res.status(200).json({
    success: true,
    settings
  });
});

module.exports = router;
