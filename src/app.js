const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const teachersRoutes = require('./routes/teachers');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const schoolsRoutes = require('./routes/schools');
const tenantsRoutes = require('./routes/tenants');
const feedbackRoutes = require('./routes/feedback');
const errorHandler = require('./middlewares/errorHandler');
const db = require('./models');

const app = express();

// Frontend ayrı bir origin'de (varsayılan Vite portu) çalıştığı için
// izin verilen adresler CORS_ORIGIN ile virgüllü olarak tanımlanır.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // origin yoksa istek tarayıcı dışından gelmiştir (curl, Postman, testler)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS engellendi: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Çok fazla giriş denemesi yapıldı, lütfen bir süre sonra tekrar deneyin',
  },
});

app.get('/health', (req, res) =>
  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()),
  })
);

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/feedback', feedbackRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Kaynak bulunamadı: ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorHandler);

async function connectDb() {
  try {
    await db.sequelize.authenticate();
    console.log('DB bağlantısı kuruldu');
  } catch (err) {
    console.error('DB bağlantı hatası', err);
    process.exit(1);
  }
}

module.exports = { app, connectDb };
