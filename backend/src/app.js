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
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
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

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5000';
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      return callback(new Error('Cross-Origin Request Blocked by PUVIMA CORS Policy'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
    credentials: true
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

app.use('/api', apiRateLimiter);
app.use('/api', healthRoutes);
app.use('/api', contactRoutes);
app.use('/api', bookingRoutes);
app.use('/api', adminRoutes);
app.use('/api', settingsRoutes);
app.use('/api', reviewRoutes);
app.use('/api', careersRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendDir, 'admin', 'index.html'));
});

app.get('/careers', (req, res) => {
  res.sendFile(path.join(frontendDir, 'pages', 'careers.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});


app.use(notFound);
app.use(errorHandler);

module.exports = app;
