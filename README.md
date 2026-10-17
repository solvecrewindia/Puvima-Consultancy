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
│   │   ├── faq.html
│   │   ├── privacy-policy.html
│   │   └── terms.html
│   │
│   ├── css/
│   │   ├── styles.css
│   │   ├── responsive.css
│   │   └── animations.css
│   │
│   ├── js/
│   │   ├── main.js
│   │   ├── navigation.js
│   │   ├── forms.js
│   │   ├── faq.js
│   │   └── portfolio.js
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
│   │   │   └── booking.routes.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── contact.controller.js
│   │   │   └── booking.controller.js
│   │   │
│   │   ├── services/
│   │   │   ├── contact.service.js
│   │   │   ├── booking.service.js
│   │   │   └── email.service.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── validateRequest.js
│   │   │   ├── rateLimiter.js
│   │   │   ├── notFound.js
│   │   │   └── errorHandler.js
│   │   │
│   │   └── utils/
│   │       └── referenceId.js
│   │
│   ├── tests/
│   │   ├── contact.test.js
│   │   └── booking.test.js
│   │
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── schema.sql
│   ├── migrations/
│   │   └── 001_initial_schema.sql
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

## 9. Automated Testing & Verification

Run the test suite:
```bash
npm test
```

Verified test coverage:
1. `POST /api/bookings`: Rejects empty payloads (HTTP 400).
2. `POST /api/bookings`: Rejects past consultation dates (HTTP 400).
3. `POST /api/bookings`: Rejects malformed date strings (HTTP 400).
4. `POST /api/bookings`: Confirms status is stored as `pending_review`.
5. `GET /api/health`: Verifies status response and ensures zero secret leakage.
6. `POST /api/contact`: Rejects empty payload (HTTP 400).
7. `POST /api/contact`: Rejects invalid email formats (HTTP 400).
8. `POST /api/contact`: Rejects short messages (<5 characters) (HTTP 400).
9. Safe Failure Handling: Returns safe user advisory responses (HTTP 503) without leaking SQL errors or credentials when database is unconfigured.

---

## 10. License & Copyright

Copyright © 2026 PUVIMA Consultancy. All rights reserved.  
*Innovation. Research. Excellence.*
