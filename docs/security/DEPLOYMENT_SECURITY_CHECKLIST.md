# PUVIMA Consultancy — Production Deployment Security Checklist

## 1. Pre-Deployment Configuration & Secrets Audit

Ensure all items in this checklist are verified prior to promoting any build to production:

| Item | Requirement | Verification Command / Check | Status |
| :---: | :--- | :--- | :---: |
| **1.1** | `NODE_ENV=production` set | Inspect environment variables; ensures stack traces are suppressed and HTTPS redirect is active. | [ ] |
| **1.2** | High-Entropy `JWT_SECRET` | Must be a minimum of 64 cryptographically random hexadecimal characters (e.g. `openssl rand -hex 32`). | [ ] |
| **1.3** | Production Admin Password | Change default `admin123` to an enterprise-grade password meeting the complexity policy. | [ ] |
| **1.4** | Database User Least Privilege | Production MySQL user must only possess `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Revoke `DROP`, `GRANT`, `ALTER`. | [ ] |
| **1.5** | Supabase Service Role Isolation | Do not expose `SUPABASE_SERVICE_ROLE_KEY` in frontend bundles or client-facing responses. | [ ] |
| **1.6** | Dependency Vulnerability Scan | Run `npm audit --prefix backend` and verify **0 vulnerabilities**. | [ ] |
| **1.7** | Git Exclusion Verification | Confirm `.env`, `uploads/`, `data/`, and `backups/` are not tracked by git (`git status --ignored`). | [ ] |

---

## 2. Infrastructure & Network Security

| Item | Requirement | Verification Check | Status |
| :---: | :--- | :--- | :---: |
| **2.1** | Strict TLS / HTTPS Only | Port 80 must automatically redirect to Port 443 with `301 Moved Permanently`. | [ ] |
| **2.2** | HSTS Active | Verify `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header in response. | [ ] |
| **2.3** | Firewall Restrictions | MySQL port `3306` must **not** be open to the public internet; bind strictly to `127.0.0.1` or internal VPC subnet. | [ ] |
| **2.4** | Non-Root Container Execution | Docker container process must run under unprivileged user (`USER node`). | [ ] |
| **2.5** | Temporary Directory Write Isolation | Ensure resume upload path uses restricted permissions (`chmod 700`). | [ ] |

---

## 3. Post-Deployment Verification Steps

Immediately following deployment to staging or production:

1. **Health Check**:
   ```bash
   curl -I https://www.puvima.com/api/health
   # Verify HTTP 200 OK and no stack trace / internal details returned
   ```

2. **Security Headers Probe**:
   ```bash
   curl -I https://www.puvima.com/api
   # Confirm presence of:
   # - X-Content-Type-Options: nosniff
   # - X-Frame-Options: DENY
   # - Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
   # - Content-Security-Policy
   ```

3. **Rate Limiting Smoke Test**:
   Execute 15 rapid POST requests to `/api/admin/login`; verify request 13 triggers `429 Too Many Requests`.

4. **Automated Test Suite**:
   ```bash
   npm test --prefix backend
   # Verify 100% of tests pass cleanly (77/77)
   ```

5. **Audit Log Initialization**:
   Confirm initial entries are recorded in `security_audit_logs` table or local JSON file.

