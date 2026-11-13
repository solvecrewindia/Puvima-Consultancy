# Puvima IT Service and Research Consultancy — API Security Architecture

## 1. Overview & API Attack Surface

The PUVIMA platform exposes RESTful endpoints supporting both public-facing interactions (contact submissions, consultation bookings, internship applications, careers listings) and authenticated administration (HR workflow, executive settings, candidate dossier review, email synchronization).

---

## 2. Sliding Window Rate Limiting Strategy

To defend against distributed denial-of-service, brute force, and automated web scraping, multiple sliding-window rate limiters are deployed across route categories:

```mermaid
flowchart LR
    Request[Incoming Request] --> Router{Endpoint Path}
    Router -->|/api/admin/login| LimiterAuth[authRateLimiter: 12 req / 15 min]
    Router -->|/api/auth/mfa/verify| LimiterMFA[mfaRateLimiter: 8 req / 10 min]
    Router -->|/api/contact, /api/booking| LimiterForm[formRateLimiter: 20 req / 15 min]
    Router -->|/api/* (Global)| LimiterGlobal[apiRateLimiter: 600 req / 15 min]
```

| Limiter Identifier | Target Routes | Threshold | Window | Breach Response |
| :--- | :--- | :---: | :---: | :--- |
| `authRateLimiter` | `/api/admin/login` | 12 attempts | 15 mins | `429 Too Many Requests` + Audit Log Event |
| `mfaRateLimiter` | `/api/auth/mfa/verify` | 8 attempts | 10 mins | `429 Too Many Requests` + Lockout Warning |
| `passwordResetLimiter` | `/api/auth/password-reset` | 5 attempts | 30 mins | `429 Too Many Requests` |
| `formRateLimiter` | `/api/contact`, `/api/booking`, `/api/internship-applications` | 20 submissions | 15 mins | `429 Too Many Requests` |
| `apiRateLimiter` | All `/api/*` endpoints | 600 requests | 15 mins | `429 Too Many Requests` |

---

## 3. Input Validation & Data Sanitization

All incoming request bodies, queries, and URL parameters undergo strict schema verification before reaching service logic:
- **String Length Enforcements**: Names, subjects, and topics are truncated or bounded to prevent buffer-related memory bloat.
- **Email Validation**: Strict regex compliance verifying standard RFC 5322 format.
- **Date String Validation**: Consultation booking dates are checked to prevent scheduling in the past or accepting malformed timestamps.
- **Number & Range Validation**: Academic percentages, CGPA tiers, and ratings are validated against known enum sets.

---

## 4. Cross-Site Scripting (XSS) Prevention

### 4.1 Server-Side HTML Escaping
All user-supplied content returned in HTML or inline email templates is escaped to convert special characters into HTML entities:
- `&` $\rightarrow$ `&amp;`
- `<` $\rightarrow$ `&lt;`
- `>` $\rightarrow$ `&gt;`
- `"` $\rightarrow$ `&quot;`
- `'` $\rightarrow$ `&#39;`

### 4.2 Content Security Policy (CSP)
Helmet configuration enforces strict CSP directives:
- `defaultSrc: ["'self'"]`
- `scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"]`
- `objectSrc: ["'none'"]`
- `frameAncestors: ["'none'"]`

---

## 5. Server-Side Request Forgery (SSRF) Guard

Outbound network connections (such as mail connections configured dynamically in `/api/mail/connect`) are inspected by `backend/src/utils/ssrfGuard.js`:

```javascript
// Pre-flight SSRF check
const imapVal = await validateOutboundHost(imapCfg.host);
if (!imapVal.valid) {
  return res.status(400).json({ success: false, message: 'Prohibited IMAP host: ' + imapVal.reason });
}
```

- Blocks loopback: `127.0.0.0/8`, `::1`.
- Blocks private IPv4 subnets: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- Blocks cloud provider metadata endpoints: `169.254.169.254`, `metadata.google.internal`.
- Resolves DNS prior to connection to defeat DNS rebinding attacks.

---

## 6. Safe Error Handling & Information Leakage Prevention

In production environments (`NODE_ENV=production`), the global error handler (`backend/src/middleware/errorHandler.js`):
- Suppresses database internal error strings, SQL query fragments, and stack traces.
- Emits generalized, safe client messages (`"An unexpected error occurred while processing your request."`).
- Writes full diagnostic details and correlation IDs strictly to server-side logs.

