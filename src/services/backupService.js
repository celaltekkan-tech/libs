'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { StringDecoder } = require('string_decoder');
const cron = require('node-cron');
const { BackupSetting, BackupLog, sequelize } = require('../models');

const TIMEZONE = 'Europe/Istanbul';
const DEFAULT_SCHEDULE = '03:30';
const SAFE_FILENAME = /^[A-Za-z0-9_.-]+\.sql\.gz$/;
const DUMP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS) || 10 * 60 * 1000;
const parsedImportMax = Number(process.env.BACKUP_IMPORT_MAX_BYTES);
const IMPORT_MAX_BYTES = Number.isFinite(parsedImportMax) && parsedImportMax > 0 ? parsedImportMax : 512 * 1024 * 1024;

// Zamanlanmış/host yedekleri: <db>_YYYYMMDD_HHMMSS.sql.gz. Saklama süresi yalnızca
// bu desene uyan dosyalara uygulanır; manuel ve yüklenen yedekler otomatik silinmez.
const MIN_KEEP_SCHEDULED = 3;
const NON_PERSISTENT_FS = new Set(['overlay', 'aufs', 'tmpfs', 'ramfs', 'proc', 'sysfs', 'devtmpfs', 'devpts', 'mqueue', 'cgroup', 'cgroup2']);

let scheduledTask = null;
let running = false;
let dbSuspended = false;

function actorFrom(user) {
  if (!user) return {};
  return { user_id: user.user_id || null, user_label: user.email || null };
}

async function writeLog(entry) {
  try {
    return await BackupLog.create(entry);
  } catch (err) {
    console.error('[backup] log yazılamadı:', err.message, JSON.stringify(entry));
    return null;
  }
}

async function finishLog(log, fields) {
  if (!log) return writeLog(fields);
  try {
    return await log.update(fields);
  } catch (err) {
    console.error('[backup] log güncellenemedi:', err.message);
    return null;
  }
}

function unescapeMountPath(value) {
  return value.replace(/\\([0-7]{3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function readMounts() {
  try {
    return fs
      .readFileSync('/proc/self/mountinfo', 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(' ');
        const sep = parts.indexOf('-');
        return { mountPoint: unescapeMountPath(parts[4]), fstype: sep >= 0 ? parts[sep + 1] : '' };
      });
  } catch {
    return null;
  }
}

function isInContainer() {
  if (process.env.BACKUP_REQUIRE_PERSISTENT_DIR === 'false') return false;
  return process.platform === 'linux' && fs.existsSync('/.dockerenv');
}

/**
 * Container içinde klasör host'a bağlı bir volume'da değilse, container her
 * yeniden oluşturulduğunda (deploy / docker compose up --build) içindeki yedekler
 * sessizce kaybolur. Bu durumda açıklama döner; kalıcıysa null.
 */
function persistenceIssue(dir) {
  // Windows'ta alınmış bir dump geri yüklenince "C:\...\backups" gelir; Linux bunu
  // göreli yol sayıp /app/C:\... altına (container içine) yazar.
  const raw = String(dir || '');
  if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(raw) || raw.includes('\\'))) {
    return `"${raw}" bir Windows klasör yolu; bu sunucuda geçersiz (yedekler container içine yazılır ve deploy'da silinir). Varsayılan klasörü (${defaultBackupDir()}) kullanın.`;
  }
  if (!isInContainer()) return null;
  const mounts = readMounts();
  if (!mounts) return null;
  const resolved = path.resolve(dir);
  let best = null;
  for (const m of mounts) {
    const mp = m.mountPoint;
    const within = resolved === mp || resolved.startsWith(mp.endsWith('/') ? mp : `${mp}/`);
    if (within && (!best || mp.length > best.mountPoint.length)) best = m;
  }
  if (best && best.mountPoint !== '/' && !NON_PERSISTENT_FS.has(best.fstype)) return null;
  return `"${resolved}" container içinde kalıcı bir klasör değil; container yeniden oluşturulduğunda (deploy) içindeki yedekler silinir. Host'a bağlı klasörü (${defaultBackupDir()}) veya docker-compose'da mount edilmiş bir yolu kullanın.`;
}

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  if (code) err.code = code;
  return err;
}

function isDbSuspended() {
  return dbSuspended;
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
  const dir = path.resolve(row.backup_dir || defaultBackupDir());
  return {
    retention_days: row.retention_days,
    backup_dir: dir,
    schedule_time: normalizeScheduleTime(row.schedule_time),
    last_run_at: row.last_run_at,
    last_run_status: row.last_run_status,
    last_run_message: row.last_run_message,
    cron_enabled: cronEnabled(),
    dir_warning: persistenceIssue(dir),
  };
}

function cronEnabled() {
  return String(process.env.BACKUP_CRON_ENABLED || 'true').toLowerCase() !== 'false';
}

/**
 * Kayıtlı klasör kalıcı değilse varsayılan (mount edilmiş) klasöre döner, orada
 * hâlâ duran yedekleri taşır ve bunu loglar. Ayarlar da düzeltilir ki panel,
 * cron ve listeleme aynı klasörü görsün.
 */
async function ensurePersistentDir(settings) {
  const current = path.resolve(settings.backup_dir || defaultBackupDir());
  const issue = persistenceIssue(current);
  if (!issue) return current;
  const fallback = defaultBackupDir();
  if (persistenceIssue(fallback)) {
    await writeLog({ action: 'config', trigger: 'system', status: 'warning', backup_dir: current, message: issue });
    return current;
  }
  await fsp.mkdir(fallback, { recursive: true });
  const moved = [];
  try {
    for (const name of await fsp.readdir(current)) {
      if (!SAFE_FILENAME.test(name)) continue;
      const target = await uniqueFilename(fallback, name);
      await moveIntoPlace(path.join(current, name), path.join(fallback, target));
      moved.push(target);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[backup] eski klasörden taşıma hatası:', err.message);
  }
  await settings.update({ backup_dir: fallback });
  await writeLog({
    action: 'config',
    trigger: 'system',
    status: 'warning',
    backup_dir: fallback,
    message: `${issue} Yedek klasörü otomatik olarak ${fallback} yapıldı.${moved.length ? ` Taşınan dosyalar: ${moved.join(', ')}` : ''}`,
  });
  return fallback;
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
  // Host script'i aynı dakikada aynı adı üretebilir; ortak .tmp dosyasına iki yazıcı gzip'i bozar.
  const tmpPath = `${destPath}.${process.pid}.${Date.now()}.tmp`;
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
    return stat.size;
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

function tailText(text, max = 800) {
  const value = String(text || '').trim();
  if (!value) return 'ayrıntı yok';
  if (value.length <= max) return value;
  return `…${value.slice(-max)}`;
}

function shouldSkipDumpLine(line) {
  const trimmed = line.replace(/^\uFEFF/, '').trim().replace(/;$/, '');
  if (/^\\(un)?restrict\s+\S+$/.test(trimmed)) return true;
  if (/^SET\s+transaction_timeout\s*=/i.test(trimmed)) return true;
  if (/^DROP\s+SCHEMA\s+(IF\s+EXISTS\s+)?public(\s+CASCADE)?$/i.test(trimmed)) return true;
  if (/^CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?public$/i.test(trimmed)) return true;
  return false;
}

function dumpSanitizer() {
  const decoder = new StringDecoder('utf8');
  let buf = '';
  let started = false;
  const prelude = [
    'SET statement_timeout = 0;',
    "SET lock_timeout = '30s';",
    'SET idle_in_transaction_session_timeout = 0;',
    'SET client_min_messages TO warning;',
    'DO $$ BEGIN',
    '  PERFORM pg_terminate_backend(pid) FROM pg_stat_activity',
    '   WHERE datname = current_database()',
    '     AND pid <> pg_backend_pid()',
    "     AND backend_type = 'client backend';",
    '  PERFORM pg_sleep(0.3);',
    'EXCEPTION WHEN OTHERS THEN',
    '  NULL;',
    'END $$;',
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'GRANT USAGE, CREATE ON SCHEMA public TO CURRENT_USER;',
    '',
  ].join('\n');

  return new Transform({
    transform(chunk, _enc, cb) {
      try {
        buf += decoder.write(chunk);
        const parts = buf.split('\n');
        buf = parts.pop() || '';
        let out = '';
        if (!started) {
          started = true;
          out += prelude;
        }
        for (const part of parts) {
          if (!shouldSkipDumpLine(part)) out += `${part}\n`;
        }
        cb(null, out);
      } catch (err) {
        cb(err);
      }
    },
    flush(cb) {
      try {
        buf += decoder.end();
        let out = '';
        if (!started) out += prelude;
        if (buf && !shouldSkipDumpLine(buf)) out += buf.endsWith('\n') ? buf : `${buf}\n`;
        cb(null, out);
      } catch (err) {
        cb(err);
      }
    },
  });
}

async function suspendDbPool() {
  const manager = sequelize.connectionManager;
  try {
    await manager.close();
  } catch (err) {
    await resumeDbPool().catch(() => {});
    throw err;
  }
  dbSuspended = true;
}

async function resumeDbPool() {
  const manager = sequelize.connectionManager;
  try {
    manager.initPools();
    if (Object.prototype.hasOwnProperty.call(manager, 'getConnection')) {
      delete manager.getConnection;
    }
    await sequelize.authenticate();
  } finally {
    dbSuspended = false;
  }
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
      '-X',
    ],
    { env: spawnEnv(db.password), windowsHide: true }
  );
  const readStderr = collectStderr(psql);
  const closed = waitForClose(psql, DUMP_TIMEOUT_MS, 'psql');
  psql.stdin.on('error', () => {});
  let pipeError = null;
  try {
    await pipeline(fs.createReadStream(filePath), zlib.createGunzip(), dumpSanitizer(), psql.stdin);
  } catch (err) {
    pipeError = err;
    if (err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      psql.kill('SIGKILL');
    }
  }

  let closeResult;
  try {
    closeResult = await closed;
  } catch (err) {
    psql.kill('SIGKILL');
    throw err;
  }
  if (closeResult.code !== 0) {
    throw httpError(
      500,
      `Geri yükleme başarısız oldu (${closeResult.signal || closeResult.code}): ${tailText(readStderr())}`,
      'RESTORE_FAILED'
    );
  }
  if (pipeError && pipeError.code !== 'EPIPE' && pipeError.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
    throw httpError(500, `Yedek aktarılamadı: ${pipeError.message}`, 'RESTORE_FAILED');
  }
}

function scheduledNamePattern() {
  const db = safeDbName(dbConfig().database).replace(/[.]/g, '\\.');
  return new RegExp(`^${db}_\\d{8}_\\d{6}\\.sql\\.gz$`);
}

async function pruneOldBackups(dir, retentionDays, protectedName) {
  const cutoff = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;
  const pattern = scheduledNamePattern();
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const candidates = [];
  for (const name of entries) {
    if (!pattern.test(name)) continue;
    const stat = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (stat) candidates.push({ name, mtimeMs: stat.mtimeMs, size: stat.size });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  // Yedekler bir süre alınamamışsa elde kalan son sağlam yedekler silinmesin.
  const removable = candidates
    .slice(MIN_KEEP_SCHEDULED)
    .filter((f) => f.mtimeMs < cutoff && f.name !== protectedName);
  const deleted = [];
  for (const file of removable) {
    try {
      await fsp.unlink(path.join(dir, file.name));
      deleted.push(file.name);
      await writeLog({
        action: 'prune',
        trigger: 'system',
        status: 'success',
        filename: file.name,
        size_bytes: file.size,
        backup_dir: dir,
        message: `Saklama süresi (${retentionDays} gün) aşıldığı için silindi. Dosya tarihi: ${new Date(file.mtimeMs).toISOString()}`,
      });
    } catch (err) {
      await writeLog({
        action: 'prune',
        trigger: 'system',
        status: 'error',
        filename: file.name,
        backup_dir: dir,
        message: `Eski yedek silinemedi: ${err.message}`,
      });
    }
  }
  return deleted;
}

function assertNotBusy() {
  if (running) {
    throw httpError(409, 'Yedekleme veya geri yükleme zaten çalışıyor', 'BACKUP_IN_PROGRESS');
  }
}

async function runBackup(trigger = 'manual', user = null) {
  if (running) {
    await writeLog({
      action: 'backup',
      trigger,
      status: 'skipped',
      message: 'Başka bir yedekleme/geri yükleme çalıştığı için atlandı',
      ...actorFrom(user),
    });
    assertNotBusy();
  }
  running = true;
  const started = new Date();
  let log = null;
  let settings = null;
  let dir = null;
  let filename = null;
  // running bayrağı her durumda finally'de bırakılır; önceden ayar/mkdir hatası
  // bayrağı kalıcı olarak true bırakıp sonraki tüm yedekleri "zaten çalışıyor" diye düşürüyordu.
  try {
    log = await writeLog({ action: 'backup', trigger, status: 'running', started_at: started, ...actorFrom(user) });
    settings = await getOrCreateSettings();
    dir = assertBackupDir(await ensurePersistentDir(settings));
    await fsp.mkdir(dir, { recursive: true });
    await settings.update({ last_run_status: 'running', last_run_at: started, last_run_message: null });

    const db = safeDbName(dbConfig().database);
    const stamp = formatStamp(started);
    filename = trigger === 'manual' ? `${db}_manuel_${stamp}.sql.gz` : `${db}_${stamp}.sql.gz`;
    filename = await uniqueFilename(dir, filename);
    const size = await dumpDatabase(path.join(dir, filename));
    const pruned = await pruneOldBackups(dir, settings.retention_days, filename);

    const label = trigger === 'scheduled' ? 'Zamanlanmış yedek alındı' : 'Manuel yedek alındı';
    const message = `${label}: ${filename}${pruned.length ? ` (${pruned.length} eski yedek silindi)` : ''}`;
    await settings.update({ last_run_status: 'success', last_run_at: new Date(), last_run_message: message });
    await finishLog(log, {
      action: 'backup',
      trigger,
      status: 'success',
      filename,
      size_bytes: size,
      backup_dir: dir,
      started_at: started,
      finished_at: new Date(),
      duration_ms: Date.now() - started.getTime(),
      message,
    });
    return { filename, backup_dir: dir };
  } catch (err) {
    if (settings) {
      await settings
        .update({ last_run_status: 'error', last_run_at: new Date(), last_run_message: err.message })
        .catch(() => {});
    }
    await finishLog(log, {
      action: 'backup',
      trigger,
      status: 'error',
      filename,
      backup_dir: dir,
      started_at: started,
      finished_at: new Date(),
      duration_ms: Date.now() - started.getTime(),
      message: err.message,
    });
    throw err;
  } finally {
    running = false;
  }
}

async function snapshotBackupState() {
  const [settings, logs] = await Promise.all([
    getOrCreateSettings(),
    BackupLog.findAll({ order: [['id', 'ASC']], raw: true }),
  ]);
  return {
    settings: {
      retention_days: settings.retention_days,
      backup_dir: settings.backup_dir,
      schedule_time: settings.schedule_time,
    },
    logs,
  };
}

/**
 * Geri yüklenen dump, BackupSettings ve BackupLogs tablolarını yedeğin alındığı
 * andaki haline döndürür: yedek klasörü/saklama süresi eski değerlere döner ve
 * yedekleme geçmişi kaybolur. Geri yükleme sonrası bu iki tablo eski haline getirilir.
 */
async function reinstateBackupState(snapshot) {
  await sequelize.transaction(async (transaction) => {
    await BackupLog.destroy({ where: {}, truncate: true, transaction });
    if (snapshot.logs.length) {
      await BackupLog.bulkCreate(snapshot.logs, { transaction });
    }
    await sequelize.query(
      `SELECT setval(pg_get_serial_sequence('"BackupLogs"', 'id'), COALESCE((SELECT MAX(id) FROM "BackupLogs"), 0) + 1, false)`,
      { transaction }
    );
    const settings = await BackupSetting.findOne({ order: [['id', 'ASC']], transaction });
    if (settings) {
      await settings.update(snapshot.settings, { transaction });
    } else {
      await BackupSetting.create(snapshot.settings, { transaction });
    }
  });
  await rescheduleBackupCron();
}

async function restoreBackup(filename, user = null) {
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
  const started = new Date();
  let suspended = false;
  let snapshot = null;
  const logBase = { action: 'restore', trigger: 'manual', filename, backup_dir: dir, started_at: started, ...actorFrom(user) };
  try {
    try {
      await assertGzipSqlDump(filePath);
      snapshot = await snapshotBackupState();
      await suspendDbPool();
      suspended = true;
      await restoreDatabase(filePath);
    } finally {
      if (suspended) {
        await resumeDbPool().catch((resumeErr) => {
          console.error('[backup] pool resume failed:', resumeErr.message);
        });
      }
    }
    await runMigrations();
    await reinstateBackupState(snapshot).catch((err) => {
      console.error('[backup] yedekleme ayarları/geçmişi geri getirilemedi:', err.message);
    });
    await writeLog({
      ...logBase,
      status: 'success',
      finished_at: new Date(),
      duration_ms: Date.now() - started.getTime(),
      message: `Veritabanı geri yüklendi: ${filename}`,
    });
    return { filename };
  } catch (err) {
    if (snapshot && suspended) {
      await reinstateBackupState(snapshot).catch(() => {});
    }
    await writeLog({
      ...logBase,
      status: 'error',
      finished_at: new Date(),
      duration_ms: Date.now() - started.getTime(),
      message: err.message,
    });
    if (!err.status) {
      throw httpError(500, err.message || 'Geri yükleme başarısız oldu', 'RESTORE_FAILED');
    }
    if (!err.code) err.code = 'RESTORE_FAILED';
    throw err;
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

function formatMegabytes(bytes) {
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

function sanitizeImportName(originalName) {
  let base = path.basename(String(originalName || 'yedek.sql.gz'));
  if (/[\u0080-\u00ff]/.test(base)) {
    const decoded = Buffer.from(base, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('\uFFFD')) base = decoded;
  }
  base = base.replace(/[^A-Za-z0-9_.-]/g, '_');
  if (!base.toLowerCase().endsWith('.sql.gz')) {
    return `import_${formatStamp()}.sql.gz`;
  }
  const stem = base.slice(0, -'.sql.gz'.length).replace(/^[._-]+|[._-]+$/g, '').slice(0, 120);
  const name = `${stem || 'import'}.sql.gz`;
  if (!SAFE_FILENAME.test(name)) return `import_${formatStamp()}.sql.gz`;
  return name;
}

async function uniqueFilename(dir, filename) {
  let candidate = filename;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fsp.access(path.join(dir, candidate));
    } catch (err) {
      if (err.code === 'ENOENT') return candidate;
      throw err;
    }
    const suffix = attempt === 0 ? formatStamp() : `${formatStamp()}_${attempt}`;
    const next = filename.replace(/\.sql\.gz$/i, `_${suffix}.sql.gz`);
    candidate = SAFE_FILENAME.test(next) ? next : `import_${suffix}.sql.gz`;
  }
  throw httpError(409, 'Aynı adlı yedek dosyası zaten var', 'BACKUP_EXISTS');
}

function readGunzipPrefix(filePath, limit = 512) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    const gunzip = zlib.createGunzip();
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      input.destroy();
      gunzip.destroy();
      if (err) reject(err);
      else resolve(value);
    };
    gunzip.on('data', (buf) => {
      chunks.push(buf);
      size += buf.length;
      if (size >= limit) finish(null, Buffer.concat(chunks).subarray(0, limit));
    });
    gunzip.on('end', () => finish(null, Buffer.concat(chunks)));
    gunzip.on('error', () => finish(httpError(400, 'Yedek dosyası açılamadı (gzip bozuk)', 'INVALID_BACKUP')));
    input.on('error', (err) => finish(err));
    input.pipe(gunzip);
  });
}

async function assertGzipSqlDump(filePath) {
  const header = Buffer.alloc(2);
  const fh = await fsp.open(filePath, 'r');
  try {
    const { bytesRead } = await fh.read(header, 0, 2, 0);
    if (bytesRead < 2 || header[0] !== 0x1f || header[1] !== 0x8b) {
      throw httpError(400, 'Dosya geçerli bir gzip yedeği değil', 'INVALID_BACKUP');
    }
  } finally {
    await fh.close();
  }
  const preview = await readGunzipPrefix(filePath);
  const text = preview.toString('utf8').replace(/^\uFEFF/, '').trimStart();
  const looksLikeDump =
    text.startsWith('--') ||
    text.startsWith('SET ') ||
    text.startsWith('SELECT ') ||
    text.startsWith('CREATE ') ||
    text.startsWith('DROP ') ||
    text.includes('PostgreSQL database dump');
  if (!looksLikeDump) {
    throw httpError(400, 'Dosya PostgreSQL yedeği gibi görünmüyor', 'INVALID_BACKUP');
  }
}

async function moveIntoPlace(src, dest) {
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.copyFile(src, dest);
    await fsp.unlink(src);
  }
}

async function resolveBackupFile(filename) {
  const settings = await getOrCreateSettings();
  const dir = assertBackupDir(settings.backup_dir || defaultBackupDir());
  const filePath = backupFilePath(dir, filename);
  try {
    await fsp.access(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw httpError(404, 'Yedek dosyası bulunamadı');
    throw err;
  }
  return { filePath, filename };
}

async function importBackupFile(tempPath, originalName, user = null) {
  let dir = null;
  try {
    const settings = await getOrCreateSettings();
    dir = assertBackupDir(settings.backup_dir || defaultBackupDir());
    await fsp.mkdir(dir, { recursive: true });
    let stat;
    try {
      stat = await fsp.stat(tempPath);
    } catch (err) {
      if (err.code === 'ENOENT') throw httpError(400, 'Yüklenen dosya bulunamadı');
      throw err;
    }
    if (stat.size < 50) {
      throw httpError(400, 'Yedek dosyası boş', 'INVALID_BACKUP');
    }
    if (stat.size > IMPORT_MAX_BYTES) {
      throw httpError(400, `Yedek dosyası en fazla ${formatMegabytes(IMPORT_MAX_BYTES)} olabilir`, 'FILE_TOO_LARGE');
    }
    await assertGzipSqlDump(tempPath);
    let name = sanitizeImportName(originalName);
    // Zamanlanmış yedek adıyla yüklenen dosya saklama süresi temizliğine girmesin.
    if (scheduledNamePattern().test(name)) name = `yuklenen_${name}`;
    const filename = await uniqueFilename(dir, name);
    const dest = backupFilePath(dir, filename);
    await moveIntoPlace(tempPath, dest);
    const saved = await fsp.stat(dest);
    await writeLog({
      action: 'import',
      trigger: 'manual',
      status: 'success',
      filename,
      size_bytes: saved.size,
      backup_dir: dir,
      message: `Yedek dosyası yüklendi (orijinal ad: ${path.basename(String(originalName || ''))})`,
      ...actorFrom(user),
    });
    return { filename, size_bytes: saved.size, created_at: saved.mtime };
  } catch (err) {
    await fsp.unlink(tempPath).catch(() => {});
    await writeLog({
      action: 'import',
      trigger: 'manual',
      status: 'error',
      backup_dir: dir,
      message: `${path.basename(String(originalName || ''))}: ${err.message}`,
      ...actorFrom(user),
    });
    throw err;
  }
}

async function logDownload(filename, user = null) {
  await writeLog({ action: 'download', trigger: 'manual', status: 'success', filename, ...actorFrom(user) });
}

async function deleteBackupFile(filename, user = null) {
  const settings = await getOrCreateSettings();
  const dir = path.resolve(settings.backup_dir || defaultBackupDir());
  const filePath = backupFilePath(dir, filename);
  let size = null;
  try {
    size = (await fsp.stat(filePath)).size;
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw httpError(404, 'Yedek dosyası bulunamadı');
    await writeLog({ action: 'delete', trigger: 'manual', status: 'error', filename, backup_dir: dir, message: err.message, ...actorFrom(user) });
    throw err;
  }
  await writeLog({
    action: 'delete',
    trigger: 'manual',
    status: 'success',
    filename,
    size_bytes: size,
    backup_dir: dir,
    message: 'Kullanıcı tarafından silindi',
    ...actorFrom(user),
  });
}

async function updateSettings(payload, user = null) {
  const dir = assertBackupDir(payload.backup_dir);
  const issue = persistenceIssue(dir);
  if (issue) throw httpError(400, issue, 'NON_PERSISTENT_DIR');
  await fsp.mkdir(dir, { recursive: true });
  const settings = await getOrCreateSettings();
  const before = serializeSettings(settings);
  await settings.update({
    retention_days: payload.retention_days,
    backup_dir: dir,
    schedule_time: normalizeScheduleTime(payload.schedule_time),
    updated_by: user?.user_id || null,
  });
  await rescheduleBackupCron();
  const after = serializeSettings(settings);
  const changes = ['backup_dir', 'schedule_time', 'retention_days']
    .filter((key) => String(before[key]) !== String(after[key]))
    .map((key) => `${key}: ${before[key]} → ${after[key]}`);
  if (changes.length) {
    await writeLog({
      action: 'config',
      trigger: 'manual',
      status: 'success',
      backup_dir: dir,
      message: `Ayarlar değişti: ${changes.join('; ')}`,
      ...actorFrom(user),
    });
  }
  return after;
}

async function listLogs({ limit = 200, action, status } = {}) {
  const where = {};
  if (action) where.action = action;
  if (status) where.status = status;
  const rows = await BackupLog.findAll({
    where,
    order: [['id', 'DESC']],
    limit: Math.min(1000, Math.max(1, Number(limit) || 200)),
    raw: true,
  });

  // Dosya hâlâ duruyor mu, duruyorsa kim sildi? Uygulama silmediği hâlde kaybolan
  // dosya = dışarıdan silinmiş / container ile birlikte kaybolmuş demektir.
  const settings = await getOrCreateSettings();
  const dir = path.resolve(settings.backup_dir || defaultBackupDir());
  let present = new Set();
  try {
    present = new Set(await fsp.readdir(dir));
  } catch {
    // klasör yoksa hepsi eksik
  }
  const producedNames = rows
    .filter((r) => r.filename && r.status === 'success' && (r.action === 'backup' || r.action === 'import'))
    .map((r) => r.filename);
  const removals = producedNames.length
    ? await BackupLog.findAll({
        where: { filename: producedNames, action: ['delete', 'prune'], status: 'success' },
        attributes: ['filename', 'action', 'created_at'],
        raw: true,
      })
    : [];
  const removedBy = new Map(removals.map((r) => [r.filename, r]));

  return rows.map((row) => {
    const out = { ...row, size_bytes: row.size_bytes == null ? null : Number(row.size_bytes) };
    if (row.filename && row.status === 'success' && (row.action === 'backup' || row.action === 'import')) {
      if (present.has(row.filename)) out.file_state = 'present';
      else if (removedBy.has(row.filename)) out.file_state = removedBy.get(row.filename).action === 'prune' ? 'pruned' : 'deleted';
      else out.file_state = 'missing';
    }
    return out;
  });
}

async function rescheduleBackupCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (!cronEnabled()) {
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

async function markInterruptedRuns() {
  const message = 'Sunucu yeniden başladığı için işlem yarıda kaldı';
  const [count] = await BackupLog.update(
    { status: 'error', finished_at: new Date(), message },
    { where: { status: 'running' } }
  );
  const settings = await getOrCreateSettings();
  if (settings.last_run_status === 'running') {
    await settings.update({ last_run_status: 'error', last_run_message: message });
  }
  return count;
}

async function startBackupCron() {
  try {
    await markInterruptedRuns();
    await ensurePersistentDir(await getOrCreateSettings());
  } catch (err) {
    console.error('[backup] başlangıç kontrolü başarısız:', err.message);
  }
  if (!cronEnabled()) {
    console.log('DB backup cron disabled (BACKUP_CRON_ENABLED=false)');
    return;
  }
  try {
    await rescheduleBackupCron();
  } catch (err) {
    console.error('[backup] cron could not start:', err.message);
    await writeLog({ action: 'config', trigger: 'system', status: 'error', message: `Zamanlayıcı başlatılamadı: ${err.message}` });
  }
}

module.exports = {
  IMPORT_MAX_BYTES,
  isDbSuspended,
  getOrCreateSettings,
  serializeSettings,
  updateSettings,
  listBackupFiles,
  listLogs,
  deleteBackupFile,
  resolveBackupFile,
  logDownload,
  importBackupFile,
  runBackup,
  restoreBackup,
  startBackupCron,
  rescheduleBackupCron,
};
