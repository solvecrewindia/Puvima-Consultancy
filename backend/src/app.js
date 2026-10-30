const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimiter');

const healthRoutes = require('./routes/health.routes');
const contactRoutes = require('./routes/contact.routes');
const bookingRoutes = require('./routes/booking.routes');
const adminRoutes = require('./routes/admin.routes');
const settingsRoutes = require('./routes/settings.routes');
const reviewRoutes = require('./routes/review.routes');
const careersRoutes = require('./routes/careers.routes');

const app = express();


app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    }
    next();
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "https://*.supabase.co", "https://*.vercel.app"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    xXssProtection: true,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  })
);

const fs = require('fs');

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      // Allow localhost and 127.0.0.1
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow any Vercel deployment preview or production domain
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      // Allow explicitly configured origins
      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const frontendDir = fs.existsSync(path.resolve(__dirname, '../../frontend'))
  ? path.resolve(__dirname, '../../frontend')
  : path.resolve(__dirname, '../../public');

// Central Unified Login route
app.get(['/login', '/login/'], (req, res, next) => {
  const loginHtml = path.join(frontendDir, 'pages', 'login.html');
  if (fs.existsSync(loginHtml)) {
    return res.sendFile(loginHtml);
  }
  const fallbackLogin = path.join(frontendDir, 'login.html');
  if (fs.existsSync(fallbackLogin)) {
    return res.sendFile(fallbackLogin);
  }
  next();
});

// Admin portal route (PUVIMA Website Administration)
app.get(['/admin', '/admin/'], (req, res, next) => {
  const adminHtml = path.join(frontendDir, 'admin', 'index.html');
  if (fs.existsSync(adminHtml)) {
    return res.sendFile(adminHtml);
  }
  next();
});

// Company Management Portal routes
const companyDir = fs.existsSync(path.join(frontendDir, 'company'))
  ? path.join(frontendDir, 'company')
  : path.resolve(__dirname, '../../frontend/company');

// Redirect any /company/login or /company/login.html directly to unified /login
app.get(['/company/login', '/company/login/', '/company/login.html'], (req, res) => {
  return res.redirect(301, '/login');
});

const companyPages = ['admin', 'hr', 'employee', 'intern', 'about'];
companyPages.forEach(p => {
  app.get([`/company/${p}`, `/company/${p}/`, `/company/${p}.html`], (req, res, next) => {
    const pagePath = path.join(companyDir, `${p}.html`);
    if (fs.existsSync(pagePath)) return res.sendFile(pagePath);
    next();
  });
});

app.get(['/company', '/company/'], (req, res, next) => {
  const compIndex = path.join(companyDir, 'index.html');
  if (fs.existsSync(compIndex)) return res.sendFile(compIndex);
  next();
});

app.use('/company', express.static(companyDir));

// Redirect /team to /about
app.get(['/team', '/team/', '/pages/team.html', '/portfolio', '/portfolio/', '/pages/portfolio.html'], (req, res) => res.redirect(301, '/about'));

// Clean friendly page routes
const pageRoutes = [
  'careers', 'contact', 'booking', 'services', 'about',
  'testimonials', 'faq', 'privacy-policy', 'terms'
];

pageRoutes.forEach(route => {
  app.get([`/${route}`, `/${route}/`, `/${route}.html`], (req, res, next) => {
    const pageHtml = path.join(frontendDir, 'pages', `${route}.html`);
    if (fs.existsSync(pageHtml)) return res.sendFile(pageHtml);
    next();
  });
});

// Static assets CDN / local serving
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

// Public API endpoints
app.get('/api', (req, res) => {
  res.json({
    service: 'PUVIMA Consultancy API',
    status: 'ONLINE',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      contact: '/api/contact',
      bookings: '/api/booking',
      careers: '/api/careers',
      reviews: '/api/reviews',
      settings: '/api/site-settings',
      admin: '/api/admin/login'
    }
  });
});

app.use('/api', apiRateLimiter);
app.use('/api', healthRoutes);
app.use('/api', contactRoutes);
app.use('/api', bookingRoutes);
app.use('/api', adminRoutes);
app.use('/api', settingsRoutes);
app.use('/api', reviewRoutes);
app.use('/api', careersRoutes);

// Serverless fallback mounts (for environments where /api prefix is stripped by host)
app.use(healthRoutes);
app.use(contactRoutes);
app.use(bookingRoutes);
app.use(adminRoutes);
app.use(settingsRoutes);
app.use(reviewRoutes);
app.use(careersRoutes);

app.get('/', (req, res, next) => {
  const indexHtml = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.json({
    service: 'PUVIMA Consultancy API',
    status: 'ONLINE',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      contact: '/api/contact',
      careers: '/api/careers',
      reviews: '/api/reviews',
      settings: '/api/settings'
    }
  });
});


app.use(notFound);
app.use(errorHandler);

module.exports = app;
