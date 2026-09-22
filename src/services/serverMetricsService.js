'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const db = require('../models');

let lastCpu = null;
let lastDbSample = null;
let cachedDiskTargets = null;
let cachedDiskTargetsAt = 0;
let inflight = null;

const DISK_TARGET_TTL_MS = 5 * 60 * 1000;

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clampPct(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, round1(value)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} zaman aşımı`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function snapshotCpu() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times || {};
    const user = times.user || 0;
    const nice = times.nice || 0;
    const sys = times.sys || 0;
    const idleTime = times.idle || 0;
    const irq = times.irq || 0;
    idle += idleTime;
    total += user + nice + sys + idleTime + irq;
  }
  return { idle, total, cores: Math.max(cpus.length, 1) };
}

function cpuPercentFrom(prev, next) {
  const idle = next.idle - prev.idle;
  const total = next.total - prev.total;
  if (total <= 0) return 0;
  return (1 - idle / total) * 100;
}

async function readCpu() {
  const prev = lastCpu;
  const now = snapshotCpu();
  if (!prev) {
    await sleep(200);
    const after = snapshotCpu();
    lastCpu = after;
    return { percent: clampPct(cpuPercentFrom(now, after)), cores: after.cores };
  }
  lastCpu = now;
  return { percent: clampPct(cpuPercentFrom(prev, now)), cores: now.cores };
}

function readMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(0, total - free);
  const percent = total > 0 ? (used / total) * 100 : 0;
  return {
    percent: clampPct(percent),
    used_bytes: used,
    total_bytes: total,
  };
}

function execFileAsync(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout || ''));
    });
  });
}

function fallbackDiskTargets() {
  if (process.platform === 'win32') {
    const root = path.parse(process.cwd()).root;
    return root ? [root] : ['C:\\'];
  }
  return ['/'];
}

async function discoverDiskTargets() {
  const now = Date.now();
  if (cachedDiskTargets && now - cachedDiskTargetsAt < DISK_TARGET_TTL_MS) {
    return cachedDiskTargets;
  }

  let targets = [];
  if (process.platform === 'win32') {
    try {
      const stdout = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -ExpandProperty DeviceID',
        ],
        8000
      );
      targets = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((id) => (id.endsWith('\\') ? id : `${id}\\`));
    } catch {
      targets = [];
    }
  }

  if (!targets.length) targets = fallbackDiskTargets();
  cachedDiskTargets = targets;
  cachedDiskTargetsAt = now;
  return targets;
}

async function readDisk(target) {
  const stat = await withTimeout(fs.promises.statfs(target), 2500, target);
  const bsize = Number(stat.bsize);
  const blocks = Number(stat.blocks);
  const bfree = Number(stat.bfree);
  const total = blocks * bsize;
  const free = bfree * bsize;
  const used = Math.max(0, total - free);
  const percent = total > 0 ? (used / total) * 100 : 0;
  return {
    mount: target,
    percent: clampPct(percent),
    used_bytes: used,
    total_bytes: total,
    free_bytes: free,
  };
}

async function readDisks() {
  const targets = await discoverDiskTargets();
  const disks = [];
  for (const target of targets) {
    try {
      disks.push(await readDisk(target));
    } catch {
      /* erişilemeyen birim atlanır */
    }
  }
  return disks;
}

async function readDatabase(cores) {
  const dialect = db.sequelize.getDialect();
  if (dialect !== 'postgres') {
    return {
      percent: null,
      active: 0,
      idle_in_transaction: 0,
      connections: 0,
      max_connections: 0,
      xact_per_sec: null,
      dialect,
    };
  }

  const [rows] = await db.sequelize.query(`
    SELECT
      (SELECT count(*)::int
         FROM pg_stat_activity
        WHERE datname = current_database()) AS connections,
      (SELECT count(*)::int
         FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'active'
          AND pid <> pg_backend_pid()) AS active,
      (SELECT count(*)::int
         FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'idle in transaction'
          AND pid <> pg_backend_pid()) AS idle_in_transaction,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
      (SELECT (xact_commit + xact_rollback)::bigint
         FROM pg_stat_database
        WHERE datname = current_database()) AS xacts
  `);

  const row = rows[0] || {};
  const connections = Number(row.connections) || 0;
  const active = Number(row.active) || 0;
  const idleInTransaction = Number(row.idle_in_transaction) || 0;
  const maxConnections = Number(row.max_connections) || 0;
  const xacts = Number(row.xacts) || 0;
  const sampledAt = Date.now();

  let xactPerSec = null;
  if (lastDbSample && sampledAt > lastDbSample.at) {
    const delta = xacts - lastDbSample.xacts;
    const seconds = (sampledAt - lastDbSample.at) / 1000;
    if (delta >= 0 && seconds > 0) xactPerSec = round1(delta / seconds);
  }
  lastDbSample = { xacts, at: sampledAt };

  // Yoğunluk: eşzamanlı çalışan (ve işlemde bekleyen) sorgular çekirdek
  // sayısına yaklaştıkça çubuk dolar. Ölçüm sorgusunun kendisi hariç tutulur.
  const busy = active + idleInTransaction;
  const percent = (busy / Math.max(cores, 1)) * 100;

  return {
    percent: clampPct(percent),
    active,
    idle_in_transaction: idleInTransaction,
    connections,
    max_connections: maxConnections,
    xact_per_sec: xactPerSec,
    dialect,
  };
}

async function collectOnce() {
  const [cpu, memory, disks] = await Promise.all([readCpu(), Promise.resolve(readMemory()), readDisks()]);

  let database = null;
  try {
    database = await readDatabase(cpu.cores);
  } catch {
    database = null;
  }

  return {
    sampled_at: new Date().toISOString(),
    hostname: os.hostname(),
    platform: process.platform,
    uptime_sec: Math.round(os.uptime()),
    cpu,
    memory,
    disks,
    database,
  };
}

function collectServerMetrics() {
  if (inflight) return inflight;
  inflight = collectOnce().finally(() => {
    inflight = null;
  });
  return inflight;
}

module.exports = { collectServerMetrics };
