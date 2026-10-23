

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const supabase = require('../config/supabase');

router.get('/health', async (req, res) => {
  const sbStatus = await supabase.testConnection();
  const dbStatus = await db.testConnection();

  const isHealthy = sbStatus.isConnected || dbStatus.isConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'puvima-consultancy-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: sbStatus.isConnected ? 'supabase_connected' : (dbStatus.isConnected ? 'mysql_connected' : 'unavailable')
  });
});

module.exports = router;
