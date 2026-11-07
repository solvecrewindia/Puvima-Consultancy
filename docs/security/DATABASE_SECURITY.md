# PUVIMA Consultancy — Database Security Architecture

## 1. Overview & Dual-Database Strategy

PUVIMA Consultancy employs a robust dual-database persistence strategy designed for high resilience and separation of concerns:

1. **MySQL Database (`puvima_db`)**: Primary operational relational datastore managing candidate applications, recruitment workflows, portal user roles, site configurations, customer reviews, and security audit logs.
2. **Supabase PostgreSQL (`jarrtmqdhfcijarbuntl`)**: Managed cloud persistence layer supporting real-time submissions, contact inquiries, consultation bookings, and cloud fallback storage.

---

## 2. SQL Injection Prevention & Parameterization

### 2.1 Universal Parameterized Queries
Under no circumstances are raw user inputs concatenated into SQL query strings. All database queries through `backend/src/config/database.js` execute via prepared statements using `mysql2/promise`:

```javascript
// Secure Pattern (Parameterized Prepared Statements)
const sql = `SELECT * FROM internship_applications WHERE department = ? AND status = ?`;
const rows = await db.query(sql, [department, status]);
```

- Query compilation and execution phases are strictly decoupled on the database engine.
- Special characters, SQL keywords, and quotation marks supplied by users are treated purely as literal string data.

---

## 3. Supabase Row Level Security (RLS) Hardening

### 3.1 Migration 005 Summary
Previously, `database/supabase_schema.sql` employed wildcard policies `FOR ALL USING (true) WITH CHECK (true)` that allowed unauthenticated clients using public anonymous API keys to read, modify, or delete sensitive contact and booking records.

Migration `005_harden_supabase_rls.sql` completely revoked these wildcard permissions and replaced them with zero-trust, role-specific policies:

| Table Name | Operation | Role | Policy Condition | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `contact_enquiries` | `INSERT` | `anon`, `authenticated` | `WITH CHECK (true)` | Permits public contact form submission |
| `contact_enquiries` | `SELECT` / `UPDATE` / `DELETE` | `anon` | **Blocked (Default Deny)** | Protects client contact PII from unauthorized reading |
| `contact_enquiries` | `ALL` | `service_role` | `USING (true)` | Allows authorized backend API processing |
| `consultation_bookings` | `INSERT` | `anon`, `authenticated` | `WITH CHECK (true)` | Permits public consultation requests |
| `consultation_bookings` | `SELECT` / `UPDATE` / `DELETE` | `anon` | **Blocked (Default Deny)** | Prevents unauthorized viewing of client consultation topics |
| `consultation_bookings` | `ALL` | `service_role` | `USING (true)` | Allows backend consultation scheduling |
| `customer_reviews` | `SELECT` | `anon`, `authenticated` | `USING (status = 'approved')` | Only approved testimonials display publicly |
| `customer_reviews` | `INSERT` | `anon`, `authenticated` | `WITH CHECK (status = 'pending')`| New reviews require administrative approval |
| `customer_reviews` | `UPDATE` / `DELETE` | `anon` | **Blocked (Default Deny)** | Prevents review tampering |
| `site_settings` | `SELECT` | `anon`, `authenticated` | `USING (true)` | Public website content retrieval |
| `site_settings` | `INSERT` / `UPDATE` / `DELETE` | `anon` | **Blocked (Default Deny)** | Prevents tampering with site configuration |

---

## 4. Connection Pool & Least-Privilege Hardening

### 4.1 Connection Pool Settings
- **Connection Limit**: Capped at 10 simultaneous pooled connections per backend instance to prevent resource exhaustion and connection starvation attacks.
- **Queue Limit**: 0 (queued requests are managed by Express backpressure rather than unbounded database worker threads).
- **Timeouts**: Ping intervals and connection acquisition timeouts are enforced to detect dropped connections immediately.

### 4.2 Production Database User Privileges
In production deployments, the database user should adhere strictly to the principle of least privilege:
- **Granted Permissions**: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables.
- **Revoked Permissions**: `DROP`, `ALTER`, `GRANT`, `SUPER`, `FILE`, `SHUTDOWN`.
- Administrative schema migrations are executed under a dedicated migration runner role.

---

## 5. Security Audit & MFA Persistence Tables

Migration `006_create_security_audit_and_mfa_tables.sql` establishes dedicated, indexed tables:
- `security_audit_logs`: Stores immutable event logs, user actors, IP addresses, correlation IDs, and redacted metadata.
- `mfa_credentials`: Stores enrolled user IDs, base32 secrets, hashed recovery codes, and activation timestamps.

