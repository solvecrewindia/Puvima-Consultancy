-- ============================================================================
-- PUVIMA Consultancy — Migration 004: Internship Audit History & HR Review
-- Tracks HR review status and maintains an immutable status transition history
-- for all internship applications across HR and Super Admin portals.
-- ============================================================================

-- 1. Ensure columns exist on internship_applications
ALTER TABLE `internship_applications`
  ADD COLUMN IF NOT EXISTS `is_reviewed_by_hr` TINYINT(1) NOT NULL DEFAULT 0 AFTER `consent_timestamp`,
  ADD COLUMN IF NOT EXISTS `hr_reviewed_at` TIMESTAMP NULL DEFAULT NULL AFTER `is_reviewed_by_hr`,
  ADD COLUMN IF NOT EXISTS `hr_reviewed_by` VARCHAR(128) DEFAULT NULL AFTER `hr_reviewed_at`;

-- 2. Modify recruitment_status column to support the 6 required lifecycle statuses
ALTER TABLE `internship_applications`
  MODIFY COLUMN `recruitment_status` VARCHAR(64) NOT NULL DEFAULT 'New';

-- 3. Create status history table for audit logging
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

