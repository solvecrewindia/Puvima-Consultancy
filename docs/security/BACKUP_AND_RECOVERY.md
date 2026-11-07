# PUVIMA Consultancy — Database Backup & Disaster Recovery Guide

## 1. Overview & Recovery Objectives

To guarantee business continuity and protect against accidental deletion, hardware failure, malicious tampering, or infrastructure disaster, PUVIMA platform implements an automated database backup and verified disaster recovery workflow.

### Service Level Objectives
- **Recovery Point Objective (RPO)**: $\le 24$ hours (daily incremental backups, point-in-time snapshots).
- **Recovery Time Objective (RTO)**: $\le 1$ hour to restore operational capability from verified backups.

---

## 2. Backup Architecture & Utility

The backup system utilizes `scripts/backup_db.js`, an independent utility that connects directly to the MySQL database engine via `mysql2/promise`. It does not depend on system binary availability (`mysqldump.exe`), making it compatible across Windows, Linux, and containerized cloud environments.

### 2.1 Backed Up Tables
1. `site_settings`
2. `contact_enquiries`
3. `consultation_bookings`
4. `customer_reviews`
5. `careers`
6. `internship_applications`
7. `internship_application_history`
8. `security_audit_logs`
9. `mfa_credentials`

### 2.2 Backup Execution Command
```bash
# Execute full database backup
node scripts/backup_db.js
```

### 2.3 Output Artifacts
Every backup execution generates two synchronized artifacts in the `backups/` directory:
1. `puvima_backup_<timestamp>.sql`: Complete SQL script containing schema table inserts wrapped in foreign key safety guards (`SET FOREIGN_KEY_CHECKS = 0; ... SET FOREIGN_KEY_CHECKS = 1;`).
2. `puvima_backup_<timestamp>.meta.json`: Cryptographic metadata record containing:
   - Database name and creation timestamp.
   - Individual table record counts.
   - Total file size.
   - SHA-256 cryptographic checksum of the SQL payload.

---

## 3. Restoration Procedure & Verification

Restoration is managed via `scripts/restore_db.js`, which features automated integrity validation and a non-destructive dry-run mode.

### 3.1 Step 1: Pre-Restoration Integrity Verification (Dry Run)
Before modifying the live database, verify statement syntax and checksum integrity:
```bash
node scripts/restore_db.js backups/puvima_backup_2026-11-05T10-58-00.sql --dry-run
```
- The restore utility verifies that the SHA-256 hash of the `.sql` file strictly matches the `.meta.json` record.
- Identifies and counts executable SQL statements without modifying any database tables.

### 3.2 Step 2: Live Database Restoration
```bash
node scripts/restore_db.js backups/puvima_backup_2026-11-05T10-58-00.sql
```
- Applies all table records sequentially.
- Reports total executed statements and statement-level warnings.

---

## 4. Offsite Storage & Retention Policy

1. **Local Retention**:
   - `backups/` maintains daily backups for the last 7 calendar days.
   - Older local dumps are archived or pruned automatically.
2. **Offsite Cloud Archival**:
   - Production backup artifacts are synchronized to an encrypted, access-restricted cloud object bucket (e.g., AWS S3 with KMS or Google Cloud Storage with customer-managed encryption keys).
   - Offsite retention follows a rolling 30-day retention policy.
3. **Immutability (WORM)**:
   - Cloud backup buckets are configured with Object Lock (Write Once, Read Many) to prevent deletion or ransomware encryption.

