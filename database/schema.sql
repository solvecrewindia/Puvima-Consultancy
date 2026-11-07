






CREATE DATABASE IF NOT EXISTS `puvima_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `puvima_db`;






CREATE TABLE IF NOT EXISTS `contact_enquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `company` VARCHAR(128) DEFAULT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('new', 'in_review', 'responded', 'archived') NOT NULL DEFAULT 'new',
  `ip_hash` VARCHAR(64) DEFAULT NULL COMMENT 'Pseudonymized client IP hash for abuse mitigation',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_contact_ref_id` (`reference_id`),
  KEY `idx_contact_email` (`email`),
  KEY `idx_contact_status` (`status`),
  KEY `idx_contact_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






CREATE TABLE IF NOT EXISTS `consultation_bookings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `company` VARCHAR(128) DEFAULT NULL,
  `topic` VARCHAR(255) NOT NULL,
  `preferred_date` DATE NOT NULL,
  `preferred_time` VARCHAR(64) NOT NULL,
  `meeting_format` VARCHAR(64) NOT NULL DEFAULT 'Virtual Video Session (Zoom / Meet)',
  `message` TEXT DEFAULT NULL,
  `status` ENUM('pending_review', 'under_evaluation', 'confirmed', 'rescheduled', 'cancelled', 'completed') NOT NULL DEFAULT 'pending_review',
  `ip_hash` VARCHAR(64) DEFAULT NULL COMMENT 'Pseudonymized client IP hash for abuse mitigation',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_booking_ref_id` (`reference_id`),
  KEY `idx_booking_email` (`email`),
  KEY `idx_booking_status` (`status`),
  KEY `idx_booking_date` (`preferred_date`),
  KEY `idx_booking_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


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



-- ============================================================================
-- 5. `internship_applications` — Direct candidate internship applications
-- ============================================================================
CREATE TABLE IF NOT EXISTS `internship_applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(64) NOT NULL,
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
  `internship_role` VARCHAR(128) NOT NULL,
  `skills` JSON DEFAULT NULL,
  `strongest_skills` TEXT NOT NULL,
  `projects_experience` TEXT DEFAULT NULL,
  `github_portfolio_url` VARCHAR(255) DEFAULT NULL,
  `resume_filename` VARCHAR(255) NOT NULL,
  `resume_drive_file_id` VARCHAR(255) DEFAULT NULL,
  `resume_drive_url` VARCHAR(512) DEFAULT NULL,
  `resume_storage_key` VARCHAR(255) DEFAULT NULL,
  `resume_mime_type` VARCHAR(128) NOT NULL,
  `resume_size_bytes` INT UNSIGNED NOT NULL,
  `motivation` TEXT NOT NULL,
  `expected_contribution` TEXT NOT NULL,
  `internship_mode` VARCHAR(64) NOT NULL,
  `duration` VARCHAR(64) NOT NULL,
  `joining_availability` VARCHAR(64) NOT NULL,
  `specific_joining_date` DATE DEFAULT NULL,
  `weekly_hours` VARCHAR(64) NOT NULL,
  `referral_source` VARCHAR(128) NOT NULL,
  `other_referral_details` VARCHAR(255) DEFAULT NULL,
  `additional_information` TEXT DEFAULT NULL,
  `consent_given` TINYINT(1) NOT NULL DEFAULT 1,
  `consent_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_reviewed_by_hr` TINYINT(1) NOT NULL DEFAULT 0,
  `hr_reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `hr_reviewed_by` VARCHAR(128) DEFAULT NULL,
  `recruitment_status` VARCHAR(64) NOT NULL DEFAULT 'New',
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

-- ============================================================================
-- 6. `internship_application_history` — Status Audit Trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS `internship_application_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `reference_id` VARCHAR(64) NOT NULL,
  `previous_status` VARCHAR(64) NOT NULL,
  `new_status` VARCHAR(64) NOT NULL,
  `changed_by_id` VARCHAR(64) DEFAULT NULL,
  `changed_by_name` VARCHAR(128) DEFAULT NULL,
  `changed_by_role` VARCHAR(64) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_iah_app_id` (`application_id`),
  KEY `idx_iah_ref_id` (`reference_id`),
  KEY `idx_iah_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
