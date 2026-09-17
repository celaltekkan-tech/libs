const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const teachersRoutes = require('./routes/teachers');
const studentsRoutes = require('./routes/students');
const classroomsRoutes = require('./routes/classrooms');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const schoolsRoutes = require('./routes/schools');
const tenantsRoutes = require('./routes/tenants');
const feedbackRoutes = require('./routes/feedback');
const licensesRoutes = require('./routes/licenses');
const auditLogsRoutes = require('./routes/auditLogs');
const subjectsRoutes = require('./routes/subjects');
const subjectClassHoursRoutes = require('./routes/subjectClassHours');
const scheduleRoutes = require('./routes/schedule');
const leavesRoutes = require('./routes/leaves');
const normPositionsRoutes = require('./routes/normPositions');
const salaryFormRoutes = require('./routes/salaryForm');
const academicYearsRoutes = require('./routes/academicYears');
const personnelCategoriesRoutes = require('./routes/personnelCategories');
const exportTemplatesRoutes = require('./routes/exportTemplates');
const dutyRoutes = require('./routes/duty');
const extraLessonsRoutes = require('./routes/extraLessons');
const attendanceRoutes = require('./routes/attendance');
const absencesRoutes = require('./routes/absences');
const dykRoutes = require('./routes/dyk');
const announcementsRoutes = require('./routes/announcements');
const parentConsentsRoutes = require('./routes/parentConsents');
const examsRoutes = require('./routes/exams');
const kelebekRoutes = require('./routes/kelebek');
const disciplinaryCasesRoutes = require('./routes/disciplinaryCases');
const guidanceRoutes = require('./routes/guidance');
const teacherDocumentsRoutes = require('./routes/teacherDocuments');
const holidaysRoutes = require('./routes/holidays');
const notificationsRoutes = require('./routes/notifications');
const workTasksRoutes = require('./routes/workTasks');
const calendarRoutes = require('./routes/calendar');
const messageLogsRoutes = require('./routes/messageLogs');
const backupsRoutes = require('./routes/backups');
const errorHandler = require('./middlewares/errorHandler');
const db = require('./models');

const app = express();

// Frontend ayrı bir origin'de (varsayılan Vite portu) çalıştığı için
// izin verilen adresler CORS_ORIGIN ile virgüllü olarak tanımlanır.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

// Geliştirmede panel LAN IP üzerinden açıldığında (örn. http://192.168.x.x:5173)
// Origin değişir; sabit localhost listesi yetmez. Yerel ağ adreslerine izin verilir.
function isPrivateLanDevOrigin(origin) {
  if (!isDev || !origin) return false;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    // Tailscale/CGNAT benzeri geliştirme ağlarında 100.64.0.0/10 aralığı görülebilir.
    const cgnat = host.match(/^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (cgnat) {
      const second = Number(cgnat[1]);
      return second >= 64 && second <= 127;
    }
    const m = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (m) {
      const second = Number(m[1]);
      return second >= 16 && second <= 31;
    }
    return false;
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // origin yoksa istek tarayıcı dışından gelmiştir (curl, Postman, testler)
      if (!origin || allowedOrigins.includes(origin) || isPrivateLanDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS engellendi: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // SPA + bildirim/zorunlu-iş poll için 300 yetersiz kalıyordu.
  max: Number(process.env.RATE_LIMIT_API_MAX || 2000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi' },
  // Giriş uçları ayrı authLimiter ile korunur; API kotası dolunca login kilitlenmesin.
  skip: (req) => {
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    return (
      path === '/api/auth/login' ||
      path === '/api/auth/register' ||
      path === '/api/auth/verify-2fa' ||
      path === '/api/auth/verify-sms' ||
      path === '/api/auth/resend-sms'
    );
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
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
app.use('/api/auth/verify-2fa', authLimiter);
app.use('/api/auth/verify-sms', authLimiter);
app.use('/api/auth/resend-sms', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/classrooms', classroomsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/licenses', licensesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/subject-class-hours', subjectClassHoursRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/norm-positions', normPositionsRoutes);
app.use('/api/salary-form', salaryFormRoutes);
app.use('/api/academic-years', academicYearsRoutes);
app.use('/api/personnel-categories', personnelCategoriesRoutes);
app.use('/api/export-templates', exportTemplatesRoutes);
app.use('/api/duty', dutyRoutes);
app.use('/api/extra-lessons', extraLessonsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/dyk', dykRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/parent-consents', parentConsentsRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/kelebek', kelebekRoutes);
app.use('/api/disciplinary-cases', disciplinaryCasesRoutes);
app.use('/api/guidance', guidanceRoutes);
app.use('/api/teacher-documents', teacherDocumentsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/work-tasks', workTasksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/message-logs', messageLogsRoutes);
app.use('/api/backups', backupsRoutes);

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
