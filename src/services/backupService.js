'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const cron = require('node-cron');
const { BackupSetting, sequelize } = require('../models');

const TIMEZONE = 'Europe/Istanbul';
const DEFAULT_SCHEDULE = '03:30';
const SAFE_FILENAME = /^[A-Za-z0-9_.-]+\.sql\.gz$/;
const DUMP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS) || 10 * 60 * 1000;

let scheduledTask = null;
let running = false;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function defaultBackupDir() {
  return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
}

function normalizeScheduleTime(value) {
  const raw = String(value || DEFAULT_SCHEDULE).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return DEFAULT_SCHEDULE;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function cronExprFromTime(hhmm) {
  const [hour, minute] = normalizeScheduleTime(hhmm).split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

function dbConfig() {
  const database = process.env.DB_NAME;
  if (!database) {
    throw httpError(500, 'DB_NAME tanımlı değil; yedekleme yapılamaz');
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: String(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database,
  };
}

function findPostgresBin(name) {
  const envKey = name === 'pg_dump' ? 'PG_DUMP_PATH' : name === 'psql' ? 'PSQL_PATH' : null;
  if (envKey && process.env[envKey]) return process.env[envKey];
  if (process.platform === 'win32') {
    const exe = `${name}.exe`;
    const versions = ['17', '16', '15', '14'];
    const roots = ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL', 'C:\\PostgreSQL'];
    for (const root of roots) {
      for (const version of versions) {
        const candidate = path.join(root, version, 'bin', exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return name;
}

function spawnEnv(password) {
  return { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '15' };
}

function formatStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}${get('second')}`;
}

function safeDbName(name) {
  return String(name || 'db').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function assertBackupDir(dir) {
  if (!dir || typeof dir !== 'string' || !dir.trim()) {
    throw httpError(400, 'Yedek klasörü belirtilmelidir');
  }
  if (dir.includes('\0')) {
    throw httpError(400, 'Geçersiz yedek klasörü');
  }
  const resolved = path.resolve(dir.trim());
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) {
    throw httpError(400, 'Yedek klasörü disk kökü olamaz');
  }
  return resolved;
}

function backupFilePath(dir, filename) {
  if (!SAFE_FILENAME.test(filename)) {
    throw httpError(400, 'Geçersiz dosya adı', 'INVALID_FILENAME');
  }
  const resolvedDir = path.resolve(dir);
  const full = path.resolve(resolvedDir, filename);
  if (path.dirname(full) !== resolvedDir) {
    throw httpError(400, 'Geçersiz dosya adı', 'INVALID_FILENAME');
  }
  return full;
}

function serializeSettings(row) {
  return {
    retention_days: row.retention_days,
    backup_dir: path.resolve(row.backup_dir || defaultBackupDir()),
    schedule_time: normalizeScheduleTime(row.schedule_time),
    last_run_at: row.last_run_at,
    last_run_status: row.last_run_status,
    last_run_message: row.last_run_message,
  };
}

async function getOrCreateSettings() {
  const existing = await BackupSetting.findOne({ order: [['id', 'ASC']] });
  if (existing) return existing;
  return BackupSetting.create({
    retention_days: 30,
    backup_dir: defaultBackupDir(),
    schedule_time: DEFAULT_SCHEDULE,
  });
}

function collectStderr(child, limit = 8000) {
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > limit) stderr = stderr.slice(-limit);
  });
  return () => stderr.trim();
}

function waitForClose(child, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(httpError(500, `${label} zaman aşımına uğradı`));
    }, timeoutMs);
    child.once('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          httpError(
            500,
            `${label} bulunamadı. PostgreSQL istemci araçlarını kurun veya PG_DUMP_PATH / PSQL_PATH tanımlayın.`
          )
        );
        return;
      }
      reject(err);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function dumpDatabase(destPath) {
  const db = dbConfig();
  const tmpPath = `${destPath}.tmp`;
  const dump = spawn(
    findPostgresBin('pg_dump'),
    [
      '-h',
      db.host,
      '-p',
      db.port,
      '-U',
      db.user,
      '-d',
      db.database,
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
      '--no-password',
    ],
    { env: spawnEnv(db.password), windowsHide: true }
  );
  const gzip = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(tmpPath);
  const readStderr = collectStderr(dump);

  dump.stdout.pipe(gzip).pipe(out);

  try {
    const [closeResult] = await Promise.all([
      waitForClose(dump, DUMP_TIMEOUT_MS, 'pg_dump'),
      new Promise((resolve, reject) => {
        gzip.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
      }),
    ]);
    if (closeResult.code !== 0) {
      throw httpError(
        500,
        `pg_dump başarısız oldu (${closeResult.signal || closeResult.code}): ${readStderr() || 'ayrıntı yok'}`
      );
    }
    const stat = await fsp.stat(tmpPath);
    if (stat.size < 50) {
      throw httpError(500, 'Yedek dosyası boş oluştu; pg_dump çıktısı geçersiz');
    }
    await fsp.rename(tmpPath, destPath);
  } catch (err) {
    dump.kill('SIGKILL');
    gzip.destroy();
    out.destroy();
    await fsp.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

function runMigrations() {
  const cli = path.join(process.cwd(), 'node_modules', 'sequelize-cli', 'lib', 'sequelize');
  const child = spawn(process.execPath, [cli, 'db:migrate'], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
  });
  const readStderr = collectStderr(child);
  return waitForClose(child, 120000, 'migration').then((result) => {
    if (result.code !== 0) {
      throw httpError(500, `Geri yükleme sonrası migration başarısız: ${readStderr() || 'ayrıntı yok'}`);
    }
  });
}

async function restoreDatabase(filePath) {
  const db = dbConfig();
  const psql = spawn(
    findPostgresBin('psql'),
    [
      '-h',
      db.host,
      '-p',
      db.port,
      '-U',
      db.user,
      '-d',
      db.database,
      '-v',
      'ON_ERROR_STOP=1',
      '--no-password',
      '-q',
    ],
    { env: spawnEnv(db.password), windowsHide: true }
  );
  const gunzip = zlib.createGunzip();
  const input = fs.createReadStream(filePath);
  const readStderr = collectStderr(psql);
  const closed = waitForClose(psql, DUMP_TIMEOUT_MS, 'psql');

  const failStream = (err) => {
    if (err && err.code === 'EPIPE') return;
    psql.kill('SIGKILL');
  };
  input.on('error', failStream);
  gunzip.on('error', failStream);
  psql.stdin.on('error', failStream);
  input.pipe(gunzip).pipe(psql.stdin);

  try {
    const closeResult = await closed;
    if (closeResult.code !== 0) {
      throw httpError(
        500,
        `Geri yükleme başarısız oldu (${closeResult.signal || closeResult.code}): ${readStderr() || 'ayrıntı yok'}`
      );
    }
  } catch (err) {
    psql.kill('SIGKILL');
    gunzip.destroy();
    input.destroy();
    throw err;
  }
}

async function pruneOldBackups(dir, retentionDays) {
  const cutoff = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  await Promise.all(
    entries
      .filter((name) => name.endsWith('.sql.gz'))
      .map(async (name) => {
        const full = path.join(dir, name);
        const stat = await fsp.stat(full);
        if (stat.mtimeMs < cutoff) await fsp.unlink(full);
      })
  );
}

function assertNotBusy() {
  if (running) {
    throw httpError(409, 'Yedekleme veya geri yükleme zaten çalışıyor', 'BACKUP_IN_PROGRESS');
  }
}

async function runBackup(trigger = 'manual') {
  assertNotBusy();
  running = true;
  const settings = await getOrCreateSettings();
  const dir = assertBackupDir(settings.backup_dir || defaultBackupDir());
  await fsp.mkdir(dir, { recursive: true });
  const started = new Date();
  await settings.update({
    last_run_status: 'running',
    last_run_at: started,
    last_run_message: null,
  });
  try {
    const filename = `${safeDbName(dbConfig().database)}_${formatStamp(started)}.sql.gz`;
    await dumpDatabase(path.join(dir, filename));
    await pruneOldBackups(dir, settings.retention_days);
    const label = trigger === 'scheduled' ? 'Zamanlanmış yedek alındı' : 'Manuel yedek alındı';
    await settings.update({
      last_run_status: 'success',
      last_run_at: new Date(),
      last_run_message: `${label}: ${filename}`,
    });
    return { filename, backup_dir: dir };
  } catch (err) {
    await settings
      .update({
        last_run_status: 'error',
        last_run_at: new Date(),
        last_run_message: err.message,
      })
      .catch(() => {});
    throw err;
  } finally {
    running = false;
  }
}

async function restoreBackup(filename) {
  assertNotBusy();
  const settings = await getOrCreateSettings();
  const dir = assertBackupDir(settings.backup_dir || defaultBackupDir());
  const filePath = backupFilePath(dir, filename);
  try {
    await fsp.access(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw httpError(404, 'Yedek dosyası bulunamadı');
    throw err;
  }

  running = true;
  try {
    await restoreDatabase(filePath);
    await sequelize.authenticate();
    await runMigrations();
    return { filename };
  } finally {
    running = false;
  }
}

async function listBackupFiles() {
  const settings = await getOrCreateSettings();
  const dir = path.resolve(settings.backup_dir || defaultBackupDir());
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const files = await Promise.all(
    entries
      .filter((name) => name.endsWith('.sql.gz'))
      .map(async (name) => {
        const stat = await fsp.stat(path.join(dir, name));
        return { filename: name, size_bytes: stat.size, created_at: stat.mtime };
      })
  );
  files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return files;
}

async function deleteBackupFile(filename) {
  const settings = await getOrCreateSettings();
  const dir = path.resolve(settings.backup_dir || defaultBackupDir());
  const filePath = backupFilePath(dir, filename);
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw httpError(404, 'Yedek dosyası bulunamadı');
    throw err;
  }
}

async function updateSettings(payload, userId) {
  const dir = assertBackupDir(payload.backup_dir);
  await fsp.mkdir(dir, { recursive: true });
  const settings = await getOrCreateSettings();
  await settings.update({
    retention_days: payload.retention_days,
    backup_dir: dir,
    schedule_time: normalizeScheduleTime(payload.schedule_time),
    updated_by: userId,
  });
  await rescheduleBackupCron();
  return serializeSettings(settings);
}

async function rescheduleBackupCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (String(process.env.BACKUP_CRON_ENABLED || 'true').toLowerCase() === 'false') {
    return;
  }
  const settings = await getOrCreateSettings();
  const expr = cronExprFromTime(settings.schedule_time);
  if (!cron.validate(expr)) {
    console.warn(`Invalid backup schedule_time "${settings.schedule_time}", cron not scheduled`);
    return;
  }
  scheduledTask = cron.schedule(
    expr,
    async () => {
      try {
        const result = await runBackup('scheduled');
        console.log(`[backup] completed ${result.filename}`);
      } catch (err) {
        if (err.code === 'BACKUP_IN_PROGRESS') {
          console.warn('[backup] skipped, already running');
          return;
        }
        console.error('[backup] job failed:', err.message);
      }
    },
    { timezone: TIMEZONE }
  );
  console.log(
    `DB backup cron scheduled: every day ${normalizeScheduleTime(settings.schedule_time)} (${TIMEZONE}) dir=${path.resolve(settings.backup_dir || defaultBackupDir())}`
  );
}

async function startBackupCron() {
  if (String(process.env.BACKUP_CRON_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('DB backup cron disabled (BACKUP_CRON_ENABLED=false)');
    return;
  }
  try {
    await rescheduleBackupCron();
  } catch (err) {
    console.error('[backup] cron could not start:', err.message);
  }
}

module.exports = {
  getOrCreateSettings,
  serializeSettings,
  updateSettings,
  listBackupFiles,
  deleteBackupFile,
  runBackup,
  restoreBackup,
  startBackupCron,
  rescheduleBackupCron,
};
