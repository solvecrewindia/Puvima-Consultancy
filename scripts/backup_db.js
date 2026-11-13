#!/usr/bin/env node
/**
 * Puvima IT Service and Research Consultancy — Automated Database Backup Utility
 * Exports structured table dumps (SQL + JSON) for disaster recovery.
 * Works independently of mysqldump system binary.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = require('../backend/src/config/database');

const BACKUP_DIR = path.resolve(__dirname, '../backups');

const TABLES = [
  'site_settings',
  'contact_enquiries',
  'consultation_bookings',
  'customer_reviews',
  'careers',
  'internship_applications',
  'internship_application_history',
  'security_audit_logs',
  'mfa_credentials'
];

async function runBackup() {
  console.log('====================================================');
  console.log(' Puvima IT Service and Research Consultancy — Database Backup Utility');
  console.log('====================================================');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sqlFile = path.join(BACKUP_DIR, `puvima_backup_${timestamp}.sql`);
  const metaFile = path.join(BACKUP_DIR, `puvima_backup_${timestamp}.meta.json`);

  const connectionStatus = await db.testConnection();
  if (!connectionStatus.isConnected) {
    console.error('[BACKUP FAILED] Database is not accessible:', connectionStatus.message);
    process.exit(1);
  }

  console.log(`[CONNECTED] MySQL server ready. Exporting tables...`);

  let sqlOutput = `-- ====================================================\n`;
  sqlOutput += `-- Puvima IT Service and Research Consultancy Database Backup\n`;
  sqlOutput += `-- Date: ${new Date().toISOString()}\n`;
  sqlOutput += `-- Database: ${process.env.DB_NAME || 'puvima_db'}\n`;
  sqlOutput += `-- ====================================================\n\n`;
  sqlOutput += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  const metadata = {
    timestamp: new Date().toISOString(),
    database: process.env.DB_NAME || 'puvima_db',
    tables: {}
  };

  for (const table of TABLES) {
    try {
      // Check if table exists
      const checkRows = await db.query(`SHOW TABLES LIKE ?`, [table]);
      if (!checkRows || checkRows.length === 0) {
        console.log(` - ${table}: Skipped (table does not exist)`);
        continue;
      }

      const rows = await db.query(`SELECT * FROM \`${table}\``);
      metadata.tables[table] = { rowCount: rows.length };

      sqlOutput += `-- Table: ${table} (${rows.length} rows)\n`;

      if (rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number' || typeof v === 'bigint') return v;
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "\\'")}'`;
            return `'${String(v).replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
          }).join(', ');

          sqlOutput += `INSERT INTO \`${table}\` (${keys}) VALUES (${values});\n`;
        }
      }
      sqlOutput += `\n`;
      console.log(` ✔ ${table}: ${rows.length} records backed up`);
    } catch (err) {
      console.warn(` ⚠ ${table}: ${err.message}`);
      metadata.tables[table] = { error: err.message };
    }
  }

  sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  // Compute checksum
  const sha256 = crypto.createHash('sha256').update(sqlOutput).digest('hex');
  metadata.sha256Checksum = sha256;
  metadata.fileSize = sqlOutput.length;

  fs.writeFileSync(sqlFile, sqlOutput, 'utf8');
  fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2), 'utf8');

  console.log('----------------------------------------------------');
  console.log(`[SUCCESS] Backup completed successfully.`);
  console.log(` - SQL Dump:    ${sqlFile} (${Math.round(sqlOutput.length / 1024)} KB)`);
  console.log(` - Metadata:    ${metaFile}`);
  console.log(` - SHA256:      ${sha256}`);
  console.log('====================================================');
  process.exit(0);
}

runBackup().catch(err => {
  console.error('[FATAL BACKUP ERROR]:', err);
  process.exit(1);
});

