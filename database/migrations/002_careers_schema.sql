-- ============================================================================
-- PUVIMA Consultancy — Database Migration: 002_careers_schema.sql
-- Module: Careers & Recruitment Management
-- Creates job_positions and job_applications tables with strict foreign keys and indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `job_positions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `department` VARCHAR(128) NOT NULL,
  `description` TEXT NOT NULL,
  `responsibilities` TEXT DEFAULT NULL,
  `required_skills` TEXT DEFAULT NULL,
  `employment_type` VARCHAR(64) NOT NULL DEFAULT 'Full-time',
  `work_arrangement` VARCHAR(64) NOT NULL DEFAULT 'Hybrid',
  `location` VARCHAR(128) NOT NULL DEFAULT 'Chennai / Bangalore, India',
  `experience_requirements` VARCHAR(128) DEFAULT NULL,
  `salary_range` VARCHAR(128) DEFAULT NULL,
  `status` ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'draft',
  `application_deadline` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_job_ref_id` (`reference_id`),
  KEY `idx_job_status` (`status`),
  KEY `idx_job_department` (`department`),
  KEY `idx_job_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
  `job_position_id` BIGINT UNSIGNED NOT NULL,
  `applicant_name` VARCHAR(128) NOT NULL,
  `applicant_email` VARCHAR(255) NOT NULL,
  `applicant_phone` VARCHAR(64) NOT NULL,
  `education` VARCHAR(255) DEFAULT NULL,
  `skills` TEXT DEFAULT NULL,
  `experience_years` VARCHAR(64) DEFAULT NULL,
  `linkedin_url` VARCHAR(255) DEFAULT NULL,
  `portfolio_url` VARCHAR(255) DEFAULT NULL,
  `cover_letter` TEXT DEFAULT NULL,
  `resume_filename` VARCHAR(255) NOT NULL,
  `resume_storage_key` VARCHAR(255) NOT NULL,
  `resume_mime_type` VARCHAR(128) NOT NULL,
  `resume_size_bytes` INT UNSIGNED NOT NULL,
  `recruitment_status` ENUM('received', 'under_review', 'shortlisted', 'interview', 'selected', 'rejected') NOT NULL DEFAULT 'received',
  `admin_notes` TEXT DEFAULT NULL,
  `ip_hash` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_app_ref_id` (`reference_id`),
  KEY `idx_app_job_position_id` (`job_position_id`),
  KEY `idx_app_email` (`applicant_email`),
  KEY `idx_app_status` (`recruitment_status`),
  KEY `idx_app_created_at` (`created_at`),
  CONSTRAINT `fk_job_app_position`
    FOREIGN KEY (`job_position_id`)
    REFERENCES `job_positions` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
