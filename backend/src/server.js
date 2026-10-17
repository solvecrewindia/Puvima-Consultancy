


const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); 

const app = require('./app');
const db = require('./config/database');

const PORT = parseInt(process.env.PORT, 10) || 5000;

async function startServer() {
  console.log('====================================================');
  console.log(' PUVIMA Consultancy — Enterprise Backend API Server');
  console.log(' Innovation. Research. Excellence.');
  console.log('====================================================');

  
  const dbStatus = await db.testConnection();
  if (dbStatus.isConnected) {
    console.log('[DB] ' + dbStatus.message);
  } else {
    console.warn('[DB WARNING] ' + dbStatus.message);
    console.warn('[DB WARNING] Database setup required. Run: mysql -u root -p < database/schema.sql');
  }

  const server = app.listen(PORT, () => {
    console.log(`[HTTP] Server active and listening on port ${PORT}`);
    console.log(`[HTTP] Local access: http://localhost:${PORT}`);
    console.log(`[HTTP] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[HTTP] Frontend served at http://localhost:${PORT}/index.html`);
  });

  
  const shutdown = async (signal) => {
    console.log(`\n[SIGNAL] Received ${signal}. Initiating graceful shutdown...`);
    server.close(() => {
      console.log('[HTTP] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
