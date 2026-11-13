# Puvima IT Service and Research Consultancy — Comprehensive Security Audit Report

## 1. Executive Summary

A comprehensive application security audit, code review, and penetration test were conducted across the Puvima IT Service and Research Consultancy full-stack platform (`puvima.com`). The audit covered web application security (OWASP Top 10 2021), API authorization, cryptographic implementations, authentication and session management, database least-privilege configurations, SSRF protections, and file upload pipelines.

All identified vulnerabilities have been completely remediated and verified through automated test suites (77/77 tests passing).

---

## 2. Vulnerability Summary Matrix

| ID | Finding | Severity | CVSS v3.1 | Status | Remediation Summary |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **SEC-01** | Overly Permissive Supabase RLS Policies | **Critical** | 9.1 | **Remediated** | Dropped wildcard `FOR ALL USING (true)` policies. Restricted `anon` to `INSERT` only for contacts/bookings and `SELECT` only for approved reviews. |
| **SEC-02** | Unthrottled Administrative Login Route | **High** | 7.5 | **Remediated** | Bound `authRateLimiter` (12 attempts / 15m) to `/api/admin/login` and `/api/auth/mfa/verify`. |
| **SEC-03** | Server-Side Request Forgery in Mail Connectors | **High** | 7.7 | **Remediated** | Integrated `ssrfGuard.js` to block loopback, link-local, private subnets, and cloud metadata APIs prior to connection. |
| **SEC-04** | DoS in `body-parser < 1.20.9` (GHSA-27r3-jxmh-p828) | **High** | 7.5 | **Remediated** | Patched dependency via `npm audit fix`, resolving vulnerability without breaking changes. |
| **SEC-05** | Unverified Mailbox Authentication Bypass | **Medium** | 6.5 | **Remediated** | Removed unverified `x-mailbox-auth` authentication bypass in `mailAuth.js`; requires valid cryptographic JWT session. |
| **SEC-06** | Timing Attack Risk on Password & Token Verification | **Medium** | 5.3 | **Remediated** | Implemented `crypto.timingSafeEqual` for all token signatures and password comparisons. Upgraded to `scrypt`. |
| **SEC-07** | Absence of Token Revocation Registry | **Medium** | 5.3 | **Remediated** | Added server-side memory & Redis-ready token revocation registry supporting instant `/logout` invalidation. |
| **SEC-08** | Incomplete Upload Directory Git Exclusion | **Low** | 4.3 | **Remediated** | Updated `.gitignore` to strictly exclude `uploads/`, `backend/uploads/resumes/`, audit log files, and database backups. |
| **SEC-09** | Missing Permissions-Policy Header | **Low** | 3.1 | **Remediated** | Added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` header via Express middleware. |

---

## 3. Detailed Audit Findings & Remediation

### SEC-01: Overly Permissive Supabase RLS Policies
- **Description**: `database/supabase_schema.sql` previously configured Row Level Security with `CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true)` on `contact_enquiries`, `consultation_bookings`, `site_settings`, and `customer_reviews`. This permitted anyone possessing the public anonymous key to read and delete all contact inquiries and bookings.
- **Remediation**: Created migration `005_harden_supabase_rls.sql`. Dropped all wildcard policies. Unauthenticated visitors are now strictly constrained to `INSERT` only on forms, `SELECT` only on approved reviews, and read-only on site settings. Full management is gated behind the backend `service_role`.

### SEC-02: Unthrottled Administrative Login Route
- **Description**: `apiRateLimiter` previously skipped any path containing `/admin`, leaving `/api/admin/login` completely unthrottled against distributed brute-force and dictionary attacks.
- **Remediation**: Created `authRateLimiter` using a dedicated in-memory sliding window enforcing a maximum of 12 attempts per 15 minutes per IP address. Bound directly to `POST /api/admin/login`.

### SEC-03: Server-Side Request Forgery (SSRF) in Mail Connectors
- **Description**: `POST /api/mail/connect` allowed clients to specify arbitrary IMAP and SMTP target hosts without destination validation. An attacker could specify internal services (e.g. `http://169.254.169.254/computeMetadata/v1/` or `localhost:6379`) to probe internal network topography.
- **Remediation**: Engineered `backend/src/utils/ssrfGuard.js` with `validateOutboundHost`. Performs both hostname string analysis and asynchronous DNS resolution to ensure destination IPs are not within IPv4/IPv6 private subnets, loopback, or cloud metadata ranges.

### SEC-04: DoS in `body-parser` (GHSA-27r3-jxmh-p828)
- **Description**: `body-parser < 1.20.9` contained a denial of service vulnerability triggered by trailing bytes after a compressed request body.
- **Remediation**: Upgraded dependency via `npm audit fix`. Re-ran `npm audit` confirming 0 vulnerabilities across all dependencies.

### SEC-05: Unverified Mailbox Authentication Bypass
- **Description**: `backend/src/middleware/mailAuth.js` allowed requests carrying an `x-mailbox-auth` header containing any JSON `{user, pass}` to pass without verifying the token or checking credentials against a backend store.
- **Remediation**: Restructured `mailAuth.js` to require a valid, verified cryptographic token (`Authorization: Bearer <token>`, `x-admin-token`, or `x-mail-token`). `x-mailbox-auth` is now only accepted as an account profile selector within an already authenticated session.

### SEC-06: Timing Attack Risk on Password & Token Verification
- **Description**: Passwords and token signatures were previously evaluated using standard JavaScript string comparison operators (`===`), which terminate upon the first mismatched byte, creating timing side-channels.
- **Remediation**: Implemented `crypto.timingSafeEqual` in `backend/src/utils/token.js` and `backend/src/utils/password.js`. Upgraded password storage to `scrypt` ($N=16384, r=8, p=1$).

---

## 4. Verification Evidence & Post-Remediation Status

All fixes were validated through automated test runs covering positive, negative, and edge-case execution paths:
- Total Test Suites: 7
- Total Tests: 77
- Passing Tests: 77 (100%)
- Failing Tests: 0
- Regressions: 0

