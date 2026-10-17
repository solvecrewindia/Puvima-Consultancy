

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/health', async (req, res) => {
  const dbStatus = await db.testConnection();

  const isHealthy = dbStatus.isConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'puvima-consultancy-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus.isConnected ? 'connected' : 'unavailable'
  });
});

module.exports = router;
