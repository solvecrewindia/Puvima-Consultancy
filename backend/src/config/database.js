

const mysql = require('mysql2/promise');

let pool = null;
let isConnected = false;
let lastError = null;

function createPool() {
  if (pool) return pool;

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'puvima_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0,
    timezone: '+00:00', 
    charset: 'utf8mb4'
  };

  try {
    pool = mysql.createPool(config);
  } catch (err) {
    lastError = err.message;
    console.error('[DB] Failed to instantiate MySQL connection pool:', err.message);
  }

  return pool;
}


let lastTestTime = 0;
let lastTestResult = null;
const TEST_CACHE_MS = 5000;

async function testConnection(force = false) {
  const now = Date.now();
  if (!force && lastTestResult && (now - lastTestTime < TEST_CACHE_MS)) {
    return lastTestResult;
  }

  const p = createPool();
  if (!p) {
    lastTestResult = { isConnected: false, message: lastError || 'Pool initialization failed' };
    lastTestTime = now;
    return lastTestResult;
  }

  try {
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    lastError = null;
    lastTestResult = { isConnected: true, message: 'MySQL connection established successfully.' };
    lastTestTime = now;
    return lastTestResult;
  } catch (err) {
    isConnected = false;
    lastError = err.message;
    lastTestResult = { isConnected: false, message: `Database unavailable: ${err.message}` };
    lastTestTime = now;
    return lastTestResult;
  }
}


async function query(sql, params = []) {
  const p = createPool();
  if (!p) {
    throw new Error('Database connection pool is not available.');
  }
  const [results] = await p.execute(sql, params);
  return results;
}

module.exports = {
  createPool,
  testConnection,
  query,
  get isConnected() {
    return isConnected;
  },
  get lastError() {
    return lastError;
  }
};
