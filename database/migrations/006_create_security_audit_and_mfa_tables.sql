-- ============================================================================
-- PUVIMA Consultancy — Migration 006: Security Audit Logging & MFA Credential Tables
-- Enterprise Security Compliance (SOC 2, ISO 27001, OWASP Top 10)
-- ============================================================================

-- 1. Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(64) UNIQUE NOT NULL,
  timestamp DATETIME(3) NOT NULL,
  action VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
  severity VARCHAR(16) NOT NULL DEFAULT 'INFO',
  user_id VARCHAR(128) NULL,
  user_role VARCHAR(64) NULL,
  user_email VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  method VARCHAR(16) NULL,
  path VARCHAR(255) NULL,
  status_code INT NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_timestamp (timestamp DESC),
  INDEX idx_audit_action (action),
  INDEX idx_audit_category (category),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Multi-Factor Authentication (MFA / TOTP) Credentials Table
CREATE TABLE IF NOT EXISTS mfa_credentials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) UNIQUE NOT NULL,
  secret VARCHAR(128) NOT NULL,
  recovery_codes JSON NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  activated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mfa_user_id (user_id),
  INDEX idx_mfa_status (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

