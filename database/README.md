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

### 3. `job_positions`
Stores careers vacancies and positions managed through the executive admin portal and displayed on `/pages/careers.html`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | AUTO_INCREMENT, PK | Internal surrogate key |
| `reference_id` | VARCHAR(64) | UNIQUE, NOT NULL | Public reference ID (e.g. `JOB-2026-ROB1`) |
| `title` | VARCHAR(255) | NOT NULL | Job position title |
| `department` | VARCHAR(128) | NOT NULL, INDEX | Division / Practice area |
| `description` | TEXT | NOT NULL | Summary / Role overview |
| `responsibilities` | TEXT | NULL | Core duties & deliverables |
| `required_skills` | TEXT | NULL | Comma/line separated qualifications |
| `employment_type` | VARCHAR(64) | NOT NULL, DEFAULT 'Full-time' | Full-time, Part-time, Contract, Internship |
| `work_arrangement` | VARCHAR(64) | NOT NULL, DEFAULT 'Hybrid' | On-site, Hybrid, Remote |
| `location` | VARCHAR(128) | NOT NULL | Office / base location |
| `experience_requirements`| VARCHAR(128) | NULL | Experience level required |
| `salary_range` | VARCHAR(128) | NULL | Optional compensation band |
| `status` | ENUM | NOT NULL, DEFAULT 'draft' | Values: `'draft'`, `'published'`, `'closed'` |
| `application_deadline` | DATE | NULL | Optional cutoff date |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | UTC timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | UTC timestamp |

### 4. `job_applications`
Stores candidate job applications submitted through `/pages/careers.html` and processed via `POST /api/careers/:id/apply`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | AUTO_INCREMENT, PK | Internal surrogate key |
| `reference_id` | VARCHAR(64) | UNIQUE, NOT NULL | Public unique tracking ID (e.g. `APP-2026-X1Y2Z3`) |
| `job_position_id` | BIGINT UNSIGNED | NOT NULL, FK, INDEX | References `job_positions(id)` (ON DELETE RESTRICT) |
| `applicant_name` | VARCHAR(128) | NOT NULL | Submitter full name |
| `applicant_email` | VARCHAR(255) | NOT NULL, INDEX | Validated applicant contact email |
| `applicant_phone` | VARCHAR(64) | NOT NULL | Contact phone number |
| `education` | VARCHAR(255) | NULL | Degree or qualification |
| `skills` | TEXT | NULL | Applicant declared competencies |
| `experience_years` | VARCHAR(64) | NULL | Years of experience |
| `linkedin_url` | VARCHAR(255) | NULL | Professional profile URL |
| `portfolio_url` | VARCHAR(255) | NULL | Portfolio / GitHub profile URL |
| `cover_letter` | TEXT | NULL | Candidate motivation or summary |
| `resume_filename` | VARCHAR(255) | NOT NULL | Cleaned original upload filename |
| `resume_storage_key`| VARCHAR(255) | NOT NULL | Server-side secure file identifier outside web root |
| `resume_mime_type` | VARCHAR(128) | NOT NULL | Validated MIME type (PDF, DOC, DOCX) |
| `resume_size_bytes` | INT UNSIGNED | NOT NULL | File size in bytes (max 5 MB) |
| `recruitment_status`| ENUM | NOT NULL, DEFAULT 'received' | Values: `'received'`, `'under_review'`, `'shortlisted'`, `'interview'`, `'selected'`, `'rejected'` |
| `admin_notes` | TEXT | NULL | Internal hiring notes |
| `ip_hash` | VARCHAR(64) | NULL | One-way SHA-256 IP hash for abuse mitigation |
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
