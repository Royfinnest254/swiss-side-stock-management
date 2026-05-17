require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./src/db');

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error('FATAL: Missing environment variables:', missingEnv.join(', '));
  process.exit(1);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}

process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
process.env.PORT = process.env.PORT || 3000;

const app = express();

// Execute automated self-healing database migrations on startup (delayed to prevent boot-time connection spike)
const { runAutoMigrations } = require('./src/db-migrations');
setTimeout(() => {
  runAutoMigrations().catch(err => console.error('[AutoMigration Error]', err.message));
}, 5000);

let compression;
try {
  compression = require('compression');
} catch (err) {
  console.warn('Warning: Optional dependency "compression" is not installed.');
}

if (compression) {
  app.use(compression());
}

// Trust proxy for cPanel/Passenger environment
app.set('trust proxy', 1);

// [AUDIT #23] Enforce HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limit request body size
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const kitchenRoutes = require('./src/routes/kitchen');
const spaRoutes = require('./src/routes/spa');
const shopRoutes = require('./src/routes/shop');
const gymRoutes = require('./src/routes/gym');
const suppliesRoutes = require('./src/routes/supplies');
const laundryRoutes = require('./src/routes/laundry');
const accommodationRoutes = require('./src/routes/accommodation');
const needsRoutes = require('./src/routes/needs');
const reportsRoutes = require('./src/routes/reports');
const dashboardRoutes = require('./src/routes/dashboard');
const recycleBinRoutes = require('./src/routes/recycleBin');
const generalSuppliesRoutes = require('./src/routes/generalSupplies');
const gymItemsRoutes = require('./src/routes/gymItems');
const itemsRoutes = require('./src/routes/items');
const roomItemsRoutes = require('./src/routes/roomItems');
const roomTemplatesRoutes = require('./src/routes/roomTemplates');
const roomsRoutes = require('./src/routes/rooms');
const transactionsRoutes = require('./src/routes/transactions');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/spa', spaRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/gym', gymRoutes);
app.use('/api/supplies', suppliesRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/accommodation', accommodationRoutes);
app.use('/api/needs', needsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/general-supplies', generalSuppliesRoutes);
app.use('/api/gym-items', gymItemsRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/room-items', roomItemsRoutes);
app.use('/api/room-templates', roomTemplatesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/transactions', transactionsRoutes);

// Remove debug route from production
// DO NOT add /debug-db back

// Static serving
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      // JS/CSS assets have hashed filenames — safe to cache for 1 year
      if (!filePath.includes('index.html')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      if (!filePath.includes('index.html')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    }
  }
}));

// Global error handler — never expose stack traces
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

// SPA Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Uncaught exception handlers to keep server alive
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception caught:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Promise Rejection caught:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Swiss Side running on port ${PORT}`);
});
