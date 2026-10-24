/**
 * PUVIMA Consultancy — Public Site Settings Route
 */

const express = require('express');
const router = express.Router();
const storeService = require('../services/store.service');

// GET /api/site-settings
router.get('/site-settings', async (req, res) => {
  const settings = await storeService.getSettings();
  res.status(200).json({
    success: true,
    settings
  });
});

module.exports = router;
