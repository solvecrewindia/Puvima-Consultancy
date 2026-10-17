# PUVIMA Consultancy — Database Documentation

This directory contains the SQL schemas and migrations for **PUVIMA Consultancy**.

## Database Overview
- **Database Name**: `puvima_db`
- **Engine**: InnoDB
- **Default Charset**: `utf8mb4`
- **Default Collation**: `utf8mb4_unicode_ci`

---

## Tables

### 1. `contact_enquiries`
Stores general inquiries submitted through `/pages/contact.html` and processed via `POST /api/contact`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | AUTO_INCREMENT, PK | Internal surrogate key |
| `reference_id` | VARCHAR(64) | UNIQUE, NOT NULL | Public unique reference ID (e.g. `PV-REQ-2026-AB12CD`) |
| `name` | VARCHAR(128) | NOT NULL | Submitter full name |
| `email` | VARCHAR(255) | NOT NULL, INDEX | Validated work email |
| `company` | VARCHAR(128) | NULL | Organization or domain name |
| `subject` | VARCHAR(255) | NULL | Subject line or practice area |
| `message` | TEXT | NOT NULL | Inquiry message body |
| `status` | ENUM | NOT NULL, DEFAULT 'new' | Values: `'new'`, `'in_review'`, `'responded'`, `'archived'` |
| `ip_hash` | VARCHAR(64) | NULL | One-way SHA-256 hash of client IP for spam protection |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | UTC timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | UTC timestamp |

### 2. `consultation_bookings`
Stores structured consultation and appointment requests submitted through `/pages/booking.html` and processed via `POST /api/bookings`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | AUTO_INCREMENT, PK | Internal surrogate key |
| `reference_id` | VARCHAR(64) | UNIQUE, NOT NULL | Public unique reference ID (e.g. `PV-REQ-2026-XYZ789`) |
| `name` | VARCHAR(128) | NOT NULL | Client full name |
| `email` | VARCHAR(255) | NOT NULL, INDEX | Business email |
| `company` | VARCHAR(128) | NULL | Organization |
| `topic` | VARCHAR(255) | NOT NULL | Selected focus area |
| `preferred_date` | DATE | NOT NULL, INDEX | Requested session date |
| `preferred_time` | VARCHAR(64) | NOT NULL | Requested time slot |
| `meeting_format` | VARCHAR(64) | NOT NULL | Format (Virtual Video Session / In-Person) |
| `message` | TEXT | NULL | Project background or notes |
| `status` | ENUM | NOT NULL, DEFAULT 'pending_review' | Values: `'pending_review'`, `'under_evaluation'`, `'confirmed'`, `'rescheduled'`, `'cancelled'`, `'completed'` |
| `ip_hash` | VARCHAR(64) | NULL | One-way SHA-256 hash for abuse prevention |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | UTC timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | UTC timestamp |

---

## Setup Instructions

### Prerequisites
- MySQL Server 8.0+ or MariaDB 10.5+

### Option A: Using the MySQL Command Line
```bash
mysql -u root -p < database/schema.sql
```

### Option B: Dedicated Least-Privilege User Setup
For production security, create a dedicated application user with restricted privileges (SELECT, INSERT, UPDATE):
```sql
CREATE DATABASE IF NOT EXISTS puvima_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'puvima_app'@'localhost' IDENTIFIED BY 'StrongPasswordHere123!';
GRANT SELECT, INSERT, UPDATE ON puvima_db.* TO 'puvima_app'@'localhost';
FLUSH PRIVILEGES;

USE puvima_db;
SOURCE database/schema.sql;
```

Update your `backend/.env` file with these credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=puvima_db
DB_USER=puvima_app
DB_PASSWORD=StrongPasswordHere123!
```
