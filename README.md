# PUVIMA Consultancy — Full-Stack Web Platform

> **Innovation. Research. Excellence.**
>
> "PUVIMA Consultancy is an emerging technology and research consultancy dedicated to transforming innovative ideas into impactful solutions. We specialize in technical project development, IT solutions, data analytics, and research support, delivering quality-driven services through innovation, expertise, and collaboration."

---

## 1. Project Overview

**PUVIMA Consultancy** is a production-ready, full-stack web platform built for an emerging technology and research consultancy. The platform is architected with a strict separation of concerns across:
1. **Frontend**: Clean, semantic HTML5, modern vanilla CSS3 design system, and modular vanilla JavaScript.
2. **Backend**: Node.js and Express.js REST API layer with server-side validation, multi-tier rate limiting, collision-resistant reference ID generation, and enterprise security headers (Helmet, restrictive CORS, proxy trust).
3. **Database**: MySQL 8.0+ production schema with indexed foreign keys, constraints, automated timestamps, and parameterized queries.

### Official Service Divisions & Focus Areas
- **Robotics & Autonomous Systems**:
  1. Autonomous mobile robots
  2. Marine waste collection and environmental robotics
  3. AI-powered object detection and recognition
  4. Intelligent navigation and docking systems
  5. Robotics automation and sensor integration
- **FinTech & Stock Market Analytics**:
  1. Stock market analysis and visualization
  2. Historical price and volume analysis
  3. Technical indicator dashboards
  4. Market trend analysis and backtesting
  5. Financial data analytics and portfolio tracking
- **AI/ML & Research Solutions**:
  1. Machine learning applications
  2. Predictive analytics and data visualization
  3. Computer vision and image analysis
  4. Technical project development
  5. Research analysis and scientific documentation

---

## 2. Directory Structure

```text
puvima-consultancy/
│
├── frontend/
│   ├── index.html
│   │
│   ├── pages/
│   │   ├── about.html
│   │   ├── services.html
│   │   ├── robotics.html
│   │   ├── fintech.html
│   │   ├── ai-ml-research.html
│   │   ├── team.html
│   │   ├── portfolio.html
│   │   ├── testimonials.html
│   │   ├── booking.html
│   │   ├── contact.html
│   │   ├── careers.html                    <-- Public Careers & Recruitment Portal
│   │   ├── faq.html
│   │   ├── privacy-policy.html
│   │   └── terms.html
│   │
│   ├── admin/
│   │   ├── index.html                      <-- Admin Portal (Careers & Applications)
│   │   ├── admin.css
│   │   └── admin.js
│   │
│   ├── css/
│   │   ├── styles.css
│   │   ├── responsive.css
│   │   ├── animations.css
│   │   └── careers.css                     <-- Careers Design System Extension
│   │
│   ├── js/
│   │   ├── main.js
│   │   ├── navigation.js
│   │   ├── forms.js
│   │   ├── faq.js
│   │   ├── portfolio.js
│   │   └── careers.js                      <-- Public Careers & Application Controller
│   │
│   ├── assets/
│   │   ├── images/
│   │   │   ├── logo/
│   │   │   ├── robotics/
│   │   │   ├── fintech/
│   │   │   ├── ai-ml/
│   │   │   ├── team/
│   │   │   └── portfolio/
│   │   └── icons/
│   │
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── app.js
│   │   │
│   │   ├── config/
│   │   │   └── database.js
│   │   │
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   ├── contact.routes.js
│   │   │   ├── booking.routes.js
│   │   │   ├── admin.routes.js
│   │   │   └── careers.routes.js           <-- Public Careers API Routes
│   │   │
│   │   ├── controllers/
│   │   │   ├── contact.controller.js
│   │   │   ├── booking.controller.js
│   │   │   ├── admin.controller.js
│   │   │   └── careers.controller.js       <-- Careers & Applications Controller
│   │   │
│   │   ├── services/
│   │   │   ├── contact.service.js
│   │   │   ├── booking.service.js
│   │   │   ├── store.service.js
│   │   │   ├── email.service.js            <-- Nodemailer SMTP & Confirmation Service
│   │   │   └── careers.service.js          <-- MySQL & Fallback Careers Persistence
│   │   │
│   │   ├── middleware/
│   │   │   ├── validateRequest.js
│   │   │   ├── rateLimiter.js
│   │   │   ├── adminAuth.js                <-- JWT Authentication Middleware
│   │   │   ├── resumeUpload.js             <-- Magic-Byte Resume Upload & Security
│   │   │   ├── notFound.js
│   │   │   └── errorHandler.js
│   │   │
│   │   └── utils/
│   │       └── referenceId.js
│   │
│   ├── uploads/
│   │   └── resumes/                        <-- Private, Non-Public Secure File Vault
│   │
│   ├── tests/
│   │   ├── contact.test.js
│   │   ├── booking.test.js
│   │   ├── admin.test.js
│   │   └── careers.test.js                 <-- Comprehensive Careers Test Suite (23 tests)
│   │
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── schema.sql
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_careers_schema.sql          <-- Job Positions & Applications Schema
│   └── README.md
│
├── _backup_original/
├── .gitignore
├── package.json
└── README.md
```

---

## 3. Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` or `v24+` recommended).
- **npm**: `v9.0.0` or higher.
- **MySQL**: MySQL Server `v8.0+` or MariaDB `v10.5+`.

---

## 4. Local Installation & Startup

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:backend
```

### Step 2: Environment Configuration
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Configure local MySQL database settings in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=puvima_db
DB_USER=root
DB_PASSWORD=your_password
DB_CONNECTION_LIMIT=10

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=20

EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_FROM=advisory@puvima.com
NOTIFICATION_RECIPIENT=advisory@puvima.com
```

### Step 3: Initialize Database
```bash
mysql -u root -p < database/schema.sql
```

### Step 4: Run Application
```bash
npm start
```
For watch mode during development:
```bash
npm run dev
```

Platform URLs:
- Main Portal: `http://localhost:5000/`
- About Us: `http://localhost:5000/pages/about.html`
- Services: `http://localhost:5000/pages/services.html`
- Robotics: `http://localhost:5000/pages/robotics.html`
- FinTech: `http://localhost:5000/pages/fintech.html`
- AI/ML & Research: `http://localhost:5000/pages/ai-ml-research.html`
- Consultation Scheduler: `http://localhost:5000/pages/booking.html`
- Contact Advisory: `http://localhost:5000/pages/contact.html`
- Health Endpoint: `http://localhost:5000/api/health`

---

## 5. SEO Architecture & Implementation

### On-Page SEO
- **Unique Metadata**: Every HTML file features an individual, descriptive `<title>` and `<meta name="description">`.
- **Target Keywords**: Natural incorporation of brand and discipline keywords:
  - PUVIMA Consultancy
  - Robotics and autonomous systems
  - FinTech and stock market analytics
  - AI and machine learning solutions
  - Technical project development
  - Research and data analytics consultancy
- **Canonical URLs**: `<link rel="canonical" href="https://puvima.com/...">` defined on every public page.
- **Social Metadata**: Open Graph (`og:title`, `og:description`, `og:url`, `og:site_name`, `og:image`, `og:type`) and Twitter Cards (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- **Structured Data (JSON-LD)**: Schema.org markup across pages:
  - `Organization` & `WebSite` on `index.html`
  - `AboutPage` on `pages/about.html`
  - `Service` schema with focus area offer catalogs on `pages/robotics.html`, `pages/fintech.html`, and `pages/ai-ml-research.html`
  - `ContactPage` on `pages/contact.html` and `pages/booking.html`
  - `FAQPage` on `pages/faq.html`
  - `BreadcrumbList` on subpages
  *(All schema strictly uses verified company information with zero fabricated claims).*

### Technical SEO Assets
- **Robots Directive** (`frontend/robots.txt`):
  ```txt
  User-agent: *
  Allow: /
  Disallow: /api/

  Sitemap: https://puvima.com/sitemap.xml
  ```
- **Sitemap** (`frontend/sitemap.xml`): Comprehensive XML document detailing all 14 canonical URLs, priorities, and update frequencies.

---

## 6. Search Engine Registration & Google Search Console Setup

Follow these verified steps once the domain is configured in production:

### 1. Domain Ownership Verification
1. Access [Google Search Console](https://search.google.com/search-console).
2. Select **Domain** property type and enter `puvima.com`.
3. Copy the provided TXT verification token.
4. Add the TXT record to your DNS management console (e.g., Cloudflare, Route53, Namecheap):
   ```text
   Type: TXT
   Host: @
   Value: google-site-verification=YOUR_VERIFICATION_TOKEN
   ```
5. Click **Verify** in Google Search Console once DNS propagates.

### 2. Sitemap Submission
1. In Google Search Console, navigate to **Indexing** → **Sitemaps**.
2. Enter `sitemap.xml` in the **Add a new sitemap** input.
3. Click **Submit**. Verify the status updates to **Success**.

### 3. URL Inspection & Crawl Testing
1. Use the **URL Inspection** tool on primary landing pages (`https://puvima.com/`, `https://puvima.com/pages/services.html`, etc.).
2. Click **Test Live URL** to confirm Googlebot receives a 200 OK status without blocking resources.
3. Request indexing for new pages.

### 4. Structured Data & Performance Validation
- Validate JSON-LD schemas using Google's [Rich Results Test](https://search.google.com/test/rich-results) and [Schema.org Validator](https://validator.schema.org/).
- Monitor Core Web Vitals (Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift) via the **Page Experience** and **Core Web Vitals** tabs in Search Console.

---

## 7. HTTPS, SSL/TLS & Production Deployment

### Production SSL Requirements
Production deployments require a valid TLS certificate issued by a trusted Certificate Authority (e.g., Let's Encrypt). Local development operates on `http://localhost:5000`.

### Reverse Proxy Configuration (Nginx)
Recommended deployment topology terminates TLS at Nginx, routing traffic to the Node.js service running on port 5000:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name puvima.com www.puvima.com;
    return 301 https://puvima.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name puvima.com;

    ssl_certificate /etc/letsencrypt/live/puvima.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/puvima.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Automated Certificate Renewal
Certbot automated renewal command:
```bash
sudo certbot renew --dry-run
```

### HSTS Activation
When deployed with `NODE_ENV=production`, the application enables HTTP Strict Transport Security (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`) via Helmet.

---

## 8. Backend Security & Data Protection

- **Helmet Security Headers**:
  - `Content-Security-Policy`: Restricts scripts, styles, fonts, and connects to verified domains (`'self'`, Google Fonts).
  - `X-Frame-Options: DENY`: Prevents clickjacking.
  - `X-Content-Type-Options: nosniff`: Prevents MIME confusion attacks.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
- **Restrictive CORS**: Only permits verified origins matching `FRONTEND_ORIGIN` or local development ports.
- **Multi-Tier Rate Limiting**:
  - API Routes (`/api/*`): 120 requests per 15-minute window per IP.
  - Form Endpoints (`/api/contact`, `/api/bookings`): 20 submissions per 15-minute window per IP.
- **SQL Injection Prevention**: 100% parameterized SQL prepared statements using `mysql2`.
- **Request Body Limits**: JSON and URL-encoded body sizes constrained to 100kb.
- **Collision-Resistant Reference IDs**: Cryptographically randomized identifiers (`PV-REQ-YYYY-XXXXXX`).
- **Data Protection**: Client IP addresses are hashed with salt before storage. Consultation requests are marked `pending_review` and never falsely confirmed without coordinator verification.
- **Dependency Audit**: Verified with `npm audit` (0 vulnerabilities found).

---

---

## 9. Careers & Recruitment Module Architecture

The Careers & Recruitment module introduces enterprise talent acquisition and engineering role management without altering PUVIMA's established visual design or breaking existing public or administrative workflows.

### 1. Database Migration Instructions
To provision the required tables in an active MySQL 8.0+ instance:
```bash
mysql -u root -p puvima_db < database/migrations/002_careers_schema.sql
```
This executes the migration idempotently:
- **`job_positions`**: Stores job title, department, description, deliverables, required skills, employment type (`Full-time`, `Contract`, `Internship`), work arrangement (`Hybrid`, `On-site`, `Remote`), base location, experience level, optional compensation band, status (`draft`, `published`, `closed`), and timestamps.
- **`job_applications`**: Stores applicant personal details, contact info, qualification/education, skills, years of experience, portfolio & LinkedIn URLs, cover letter, resume metadata, and recruitment workflow status (`received`, `under_review`, `shortlisted`, `interview`, `selected`, `rejected`).
- **Data Integrity**: Enforces `FOREIGN KEY (job_position_id) REFERENCES job_positions(id) ON DELETE RESTRICT`, guaranteeing that closing or archiving a position never deletes historical candidate submissions.
- **Dual Persistence**: When MySQL is offline or unconfigured, the system automatically falls back to `backend/data/careers.json` with zero service interruption.

### 2. SMTP & Email Notification Setup
Candidate submissions automatically notify the recruitment desk and send confirmations to applicants when valid SMTP credentials are provided in `backend/.env`:
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=recruitment@puvima.com
SMTP_PASS=your_secure_smtp_password
MAIL_FROM="PUVIMA Careers <careers@puvima.com>"
RECRUITMENT_EMAIL=hr@puvima.com
```
**Reliability & Failure Safety**:
- Emails are dispatched **strictly after** durable persistence to MySQL/store.
- If outbound email fails, the candidate's application is preserved safely in the database, the failure is safely logged without leaking secrets or resume data, and the response informs the candidate of their durable reference ID.
- Outbound emails never reveal other applicants' personal data.

### 3. Secure Resume Storage & Magic-Byte Validation
- **Vault Location**: Resumes are stored in `backend/uploads/resumes/`, completely outside the public web root (`frontend/`). Direct public URL access is blocked.
- **Deep Signature Inspection**: Rather than trusting browser MIME headers or file extensions, `backend/src/middleware/resumeUpload.js` inspects binary buffer magic bytes:
  - PDF: `%PDF-` (`0x25 0x50 0x44 0x46`)
  - DOC: Compound Binary Document format (`0xD0 0xCF 0x11 0xE0`)
  - DOCX: Zip archive magic (`0x50 0x4B 0x03 0x04`)
- **Sanitized UUID Storage**: Files are saved with cryptographically random UUIDs (`resume_<uuid>.<ext>`) to eliminate collisions and path traversal attacks (`../`).
- **Enforced File Limits**: Max 5 MB (`MAX_RESUME_SIZE_BYTES=5242880`). Executables, scripts, and spoofed files are rejected with HTTP 400.
- **Authenticated Streaming**: The resume can only be downloaded via `GET /api/admin/applications/:id/resume`, which verifies valid administrator JWT credentials before streaming the binary with sanitized download headers.

### 4. Admin Portal Usage
Authorized administrators access the Careers & Recruitment Center under the **Careers** tab in `frontend/admin/index.html`:
- **Vacancies Management**: Create and edit engineering roles across Robotics, FinTech, AI/ML, Software Development, and Research. Toggle status between `draft`, `published`, and `closed`.
- **Applications Tracking**: Review candidate submissions, filter by recruitment stage (`received`, `under_review`, `shortlisted`, `interview`, `selected`, `rejected`), filter by specific job vacancy, or search by candidate name/email/skills.
- **Candidate Evaluation**: Inspect education, portfolio links, skills pills, and candidate cover letters. Record internal interview assessment notes and download original candidate resumes securely.

### 5. API Reference
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/careers` | Public | List published open positions |
| `GET` | `/api/careers/:id` | Public | Retrieve published position details |
| `POST` | `/api/careers/:id/apply` | Public (Rate Limited) | Submit candidate application and resume |
| `GET` | `/api/admin/careers` | Admin (JWT) | List all positions (including drafts & closed) |
| `POST` | `/api/admin/careers` | Admin (JWT) | Create a new job vacancy |
| `PUT` | `/api/admin/careers/:id` | Admin (JWT) | Update job position details |
| `PATCH`| `/api/admin/careers/:id/status` | Admin (JWT) | Transition job status (`draft`, `published`, `closed`) |
| `GET` | `/api/admin/applications` | Admin (JWT) | List candidate applications with filters |
| `GET` | `/api/admin/applications/:id` | Admin (JWT) | Inspect single application details |
| `PATCH`| `/api/admin/applications/:id/status`| Admin (JWT) | Update recruitment stage and notes |
| `GET` | `/api/admin/applications/:id/resume`| Admin (JWT) | Securely stream and download candidate resume |

---

## 10. Automated Testing & Verification

Run the complete test suite:
```bash
npm test
```

### Verified Test Coverage (41 Passing Tests across 4 Suites)
1. **Admin & Settings API Test Suite (9 Tests)**:
   - Rejection of invalid admin credentials (HTTP 401).
   - JWT issuance on verified administrator login.
   - Guarding admin routes against unauthenticated requests.
   - Retrieval of inquiries with valid Bearer token.
   - Public access to site settings without authentication.
   - Administrative updating of site settings.
   - Submission of client reviews from main page.
   - Public retrieval of approved reviews only.
   - Administrative review moderation and homepage promotion.
2. **Consultation Booking API Test Suite (4 Tests)**:
   - Rejection of empty payloads with HTTP 400.
   - Rejection of past consultation dates.
   - Rejection of malformed date strings.
   - Strict `pending_review` status persistence.
3. **Careers & Recruitment API Test Suite (23 Tests)**:
   - Public listing of published positions (`GET /api/careers`).
   - HTTP 404 for non-existent positions.
   - Authentication enforcement on admin positions listing (`GET /api/admin/careers`).
   - Authentication enforcement on position creation (`POST /api/admin/careers`).
   - Validation of required fields on position creation (HTTP 400).
   - Administrative creation of new job positions.
   - Strict invisibility of draft positions from public endpoints.
   - Updating position details via `PUT /api/admin/careers/:id`.
   - Publishing positions via `PATCH /api/admin/careers/:id/status`.
   - Immediate visibility of published positions on public endpoints.
   - Single position retrieval via `GET /api/careers/:id`.
   - Form field validation on application submission (`POST /api/careers/:id/apply`).
   - Rejection of files without authentic binary PDF/DOC magic-byte signatures.
   - Rejection of unsupported extensions (e.g. `.exe`, `.sh`).
   - Successful application processing with durable save, authentic PDF resume, and collision-resistant reference ID.
   - Rejection of applications for non-existent positions (HTTP 404).
   - Closing positions and preventing subsequent applications.
   - Authentication enforcement on applications listing (`GET /api/admin/applications`).
   - Application filtering and listing with valid admin token.
   - Detail retrieval for single candidate application.
   - Updating recruitment status and admin evaluation notes (`PATCH /api/admin/applications/:id/status`).
   - Unauthenticated resume access rejection with HTTP 401.
   - Authorized secure resume download via streaming (`GET /api/admin/applications/:id/resume`).
4. **Contact & Health API Test Suite (5 Tests)**:
   - System health status validation without secret leakage.
   - Rejection of empty contact payloads with HTTP 400.
   - Email format validation.
   - Message length constraints.
   - Resilient database offline fallback handling.

---

## 11. License & Copyright

Copyright © 2026 PUVIMA Consultancy. All rights reserved.  
*Innovation. Research. Excellence.*

