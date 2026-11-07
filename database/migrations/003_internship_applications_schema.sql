-- ============================================================================
-- PUVIMA Consultancy — Migration 003: Internship Applications Schema
-- Durably stores complete candidate internship applications with Google Drive
-- resume metadata, multi-step questionnaire answers, and recruitment status.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `internship_applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
  
  -- Section 01: Personal & Academic Information
  `full_name` VARCHAR(128) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(64) NOT NULL,
  `city_state` VARCHAR(128) NOT NULL,
  `linkedin_url` VARCHAR(255) DEFAULT NULL,
  `college` VARCHAR(255) NOT NULL,
  `degree` VARCHAR(255) NOT NULL,
  `study_year` VARCHAR(64) NOT NULL,
  `graduation_year` VARCHAR(16) NOT NULL,
  `cgpa_range` VARCHAR(64) NOT NULL,

  -- Section 02: Internship Role & Skills
  `internship_role` VARCHAR(128) NOT NULL,
  `skills` JSON DEFAULT NULL,
  `strongest_skills` TEXT NOT NULL,
  `projects_experience` TEXT DEFAULT NULL,
  `github_portfolio_url` VARCHAR(255) DEFAULT NULL,

  -- Resume & Google Drive Storage
  `resume_filename` VARCHAR(255) NOT NULL,
  `resume_drive_file_id` VARCHAR(255) DEFAULT NULL,
  `resume_drive_url` VARCHAR(512) DEFAULT NULL,
  `resume_storage_key` VARCHAR(255) DEFAULT NULL,
  `resume_mime_type` VARCHAR(128) NOT NULL,
  `resume_size_bytes` INT UNSIGNED NOT NULL,

  -- Section 03: Motivation & Availability
  `motivation` TEXT NOT NULL,
  `expected_contribution` TEXT NOT NULL,
  `internship_mode` VARCHAR(64) NOT NULL,
  `duration` VARCHAR(64) NOT NULL,
  `joining_availability` VARCHAR(64) NOT NULL,
  `specific_joining_date` DATE DEFAULT NULL,
  `weekly_hours` VARCHAR(64) NOT NULL,

  -- Section 04: Final Details
  `referral_source` VARCHAR(128) NOT NULL,
  `other_referral_details` VARCHAR(255) DEFAULT NULL,
  `additional_information` TEXT DEFAULT NULL,

  -- Section 05: Compliance & Recruitment Workflow
  `consent_given` TINYINT(1) NOT NULL DEFAULT 1,
  `consent_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `recruitment_status` ENUM('received', 'under_review', 'shortlisted', 'interview', 'selected', 'rejected') NOT NULL DEFAULT 'received',
  `admin_notes` TEXT DEFAULT NULL,
  `email_notification_status` VARCHAR(64) DEFAULT 'pending',
  `ip_hash` VARCHAR(64) DEFAULT NULL,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ia_ref_id` (`reference_id`),
  KEY `idx_ia_email` (`email`),
  KEY `idx_ia_role` (`internship_role`),
  KEY `idx_ia_status` (`recruitment_status`),
  KEY `idx_ia_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

