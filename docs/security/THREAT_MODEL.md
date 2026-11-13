# Puvima IT Service and Research Consultancy — Threat Model & STRIDE Analysis

## 1. Scope & System Assets

The PUVIMA platform processes sensitive commercial and personal data. This threat model identifies critical assets, potential threat actors, attack vectors, and implemented countermeasures.

### Critical Assets Inventory
1. **Administrative & Staff Credentials**: Passwords, MFA secrets, and session JWTs for SuperAdmin, HR, Employee, and Intern accounts.
2. **Candidate PII & Resumes**: Full names, contact details, academic transcripts, and resume PDF/DOC documents submitted to `/pages/careers`.
3. **Client Consultations & Enquiries**: Business inquiries, contact information, project ideas, and scheduled meetings.
4. **Corporate Mailbox Access**: GoDaddy / Gmail IMAP and SMTP credentials used in `/mail`.
5. **Database Infrastructure**: MySQL relational database and Supabase PostgreSQL instance.

---

## 2. Threat Actors & Capabilities

| Threat Actor | Motivation | Capabilities | Target Assets |
| :--- | :--- | :--- | :--- |
| **External Untrusted Attacker** | Data theft, disruption, unauthorized access | Scripting, brute force, vulnerability scanning, automated exploitation | Public API, Admin portal login, Upload endpoints, Mail connectors |
| **Malicious Candidate / Applicant** | System compromise, persistent backdoor | Malicious file payloads (executables disguised as resumes, Polyglots, SVG XSS) | Resume ingestion system, File storage, HR review portals |
| **Compromised Employee / Intern** | Privilege escalation, data exfiltration | Authenticated low-privilege portal session, local access | HR records, applicant dossiers, executive settings, administrative endpoints |
| **Man-in-the-Middle (MitM)** | Credential interception, session hijacking | Network sniffing, DNS spoofing, unsecured public Wi-Fi | In-transit HTTP traffic, JWT tokens, session headers |

---

## 3. STRIDE Threat Analysis & Mitigation Matrix

### 3.1 Spoofing (Identity Deception)
- **Threat**: Attacker attempts credential stuffing or brute-force against `/api/admin/login` or attempts to forge portal headers (`x-portal-user-role`).
- **Impact**: Unauthorized administrative takeover.
- **Implemented Mitigation**:
  - `authRateLimiter` restricts login attempts to 12 per 15 minutes per IP address.
  - Constant-time verification (`crypto.timingSafeEqual`) prevents timing-based credential enumeration.
  - Two-factor authentication (RFC 6238 TOTP) enforces second-factor proof.
  - Header-based portal access strictly validates underlying JWT signatures; unverified headers are rejected.

### 3.2 Tampering (Data Manipulation)
- **Threat**: Attacker tampers with JWT claims (`role: admin`) or modifies Supabase database records using public anon keys.
- **Impact**: Privilege escalation, unauthorized alteration of site settings or consultation bookings.
- **Implemented Mitigation**:
  - Timing-safe HMAC-SHA256 signature verification defeats signature forgery and payload tampering.
  - Explicit algorithm validation (`alg: HS256`) rejects `none` algorithm exploits.
  - Supabase Row Level Security (RLS) policies completely disallow public `UPDATE` and `DELETE` queries on all tables.

### 3.3 Repudiation (Denial of Actions)
- **Threat**: Rogue administrator or compromised account updates candidate status or downloads private resumes and denies performing the action.
- **Impact**: Inability to conduct forensic analysis or prove chain of custody.
- **Implemented Mitigation**:
  - Structured Security Audit Logger (`audit.service.js`) captures every state mutation, resume download, authentication success, and authorization failure.
  - Events record immutable timestamps, user IDs, actor roles, IP addresses, user agents, and correlation IDs.

### 3.4 Information Disclosure (Data Leakage)
- **Threat**: 
  - Unauthenticated attacker scrapes candidate resumes or downloads client contact submissions.
  - Path traversal attack (`../../etc/passwd` or `..\..\uploads\resumes\secret.pdf`) leaks arbitrary files.
  - Server stack traces leak database passwords and environment variables.
- **Impact**: Massive privacy violation, GDPR / DPDP non-compliance.
- **Implemented Mitigation**:
  - Candidate resumes are stored with UUID v4 random storage keys without guessable incremental IDs.
  - Resume download endpoints require authenticated HR or SuperAdmin tokens (`requireHrOrAdmin`).
  - Path traversal guard cleans filenames and strictly validates base paths with `path.resolve`.
  - Production error handler suppresses internal stack traces and database error codes.

### 3.5 Denial of Service (DoS / Resource Exhaustion)
- **Threat**: 
  - Attacker floods contact form or application form, filling disk space or database pool.
  - Attacker exploits `body-parser` trailing bytes or sends massive JSON payloads.
- **Impact**: Server unresponsiveness, denial of service for genuine clients and applicants.
- **Implemented Mitigation**:
  - Upgraded dependencies (`body-parser >= 1.20.9`) resolving GHSA-27r3-jxmh-p828.
  - Request body limits enforced strictly at 10MB.
  - Multi-tier sliding window rate limiters:
    - Public forms: 20 submissions per 15 minutes.
    - Global API: 600 requests per 15 minutes.
  - Connection pool timeouts and non-blocking asynchronous event loops.

### 3.6 Elevation of Privilege (Unauthorized Capability Expansion)
- **Threat**: Intern or Employee accesses HR or SuperAdmin routes (`/api/hr/internship-applications`, `/api/admin/settings`).
- **Impact**: Unauthorized access to executive compensation, personnel records, and company settings.
- **Implemented Mitigation**:
  - `portalAuth.js` explicitly blocks `Employee` and `Intern` roles with `403 Forbidden` from management endpoints.
  - Role hierarchy enforcement: `SuperAdmin` > `Admin` > `HR` > `Employee` / `Intern`.
  - Zero-trust default: all unmapped or unauthenticated requests default to `401 Unauthorized`.

