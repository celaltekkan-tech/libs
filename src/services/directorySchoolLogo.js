'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { Op } = require('sequelize');

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'directory-schools');
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_FETCHES = 4;

const SKIP_SRC =
  /tema\/|www\/images\/projeler|meb[_-]?logo|atabayrak|ataturk|harita|iller\/|sosyalmedya|fatih\.png|guvenli|okullarhayat|meslegim|footer|icon-|loading|cross\.png|home\.png|rss\.png|sinavok|duyuruok|proje_img|turkiye-haritasi/i;

const LOGO_NAME = /(amblem|okul.?logo|(^|\/|_|-)logo(\.|_|-|$))/i;
const PHOTO_NAME = /whatsapp|dsc_|img_\d|adsiz|yakantop|slider/i;

const inFlight = new Map();
let activeFetches = 0;
const fetchQueue = [];

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionOf(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

function absolutePath(storedName) {
  return path.join(UPLOAD_ROOT, path.basename(storedName));
}

function mimeTypeFor(storedName) {
  const ext = extensionOf(storedName);
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function imageKind(buffer) {
  if (!buffer || buffer.length < 24) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}

function saveBuffer(directorySchoolId, buffer, ext) {
  ensureUploadDir();
  const safeExt = ['.png', '.jpg', '.webp'].includes(ext) ? ext : '.jpg';
  const storedName = `dir-${directorySchoolId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
  fs.writeFileSync(absolutePath(storedName), buffer);
  return storedName;
}

function removeStoredFile(storedName) {
  if (!storedName) return;
  try {
    fs.unlinkSync(absolutePath(storedName));
  } catch {
    // yoksa geç
  }
}

function withFetchLimit(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeFetches += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          const next = fetchQueue.shift();
          if (next) next();
        });
    };
    if (activeFetches < MAX_CONCURRENT_FETCHES) run();
    else fetchQueue.push(run);
  });
}

function fetchUrl(url, headers = {}, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('too many redirects'));
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || undefined,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,image/avif,image/webp,image/apng,*/*;q=0.8',
          ...headers,
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          fetchUrl(next, headers, redirects + 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        let total = 0;
        let aborted = false;
        res.on('data', (chunk) => {
          total += chunk.length;
          if (total > MAX_FILE_SIZE) {
            aborted = true;
            req.destroy();
            reject(new Error('file too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (aborted) return;
          resolve({
            status: res.statusCode || 0,
            url,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchPage(website) {
  const start = /^https?:\/\//i.test(website) ? website : `http://${website}`;
  let res = await fetchUrl(start);
  const html = res.body.toString('utf8');
  const token = html.match(/sto-idd=([a-f0-9]+)/i);
  if (token && res.body.length < 2000) {
    res = await fetchUrl(start, { Cookie: `sto-idd=${token[1]}` });
  }
  return res;
}

function scoreLogoSrc(src) {
  const lower = String(src || '').toLowerCase();
  if (!/\.(png|jpe?g|webp)(\?|#|$)/i.test(lower)) return 0;
  if (SKIP_SRC.test(lower)) return 0;
  let score = 0;
  if (LOGO_NAME.test(lower)) score += 50;
  if (/meb_iys_dosyalar/.test(lower)) score += 8;
  if (/\/k_[^/]+$/i.test(lower) || /\/k_[a-z0-9]/i.test(path.basename(lower))) score -= 6;
  if (PHOTO_NAME.test(lower)) score -= 25;
  return score;
}

function collectLogoCandidates(html, baseUrl) {
  const found = [];
  const seen = new Set();
  const re = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = match[1];
    const score = scoreLogoSrc(raw);
    if (score < 40) continue;
    let absolute;
    try {
      absolute = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    found.push({ url: absolute, score });
  }
  found.sort((a, b) => b.score - a.score);
  return found;
}

function unthumbUrl(fileUrl) {
  return fileUrl.replace(/\/k_([^/?#]+)$/i, '/$1');
}

async function downloadImage(fileUrl) {
  const res = await fetchUrl(fileUrl);
  if (res.status !== 200) return null;
  const kind = imageKind(res.body);
  if (!kind) return null;
  const ext = kind === 'png' ? '.png' : kind === 'webp' ? '.webp' : '.jpg';
  return { buffer: res.body, ext };
}

async function downloadPreferredImage(fileUrl) {
  const full = unthumbUrl(fileUrl);
  if (full !== fileUrl) {
    const bigger = await downloadImage(full);
    if (bigger) return bigger;
  }
  return downloadImage(fileUrl);
}

async function copyFromTenantSchool(directorySchool) {
  const { School } = require('../models');
  const clauses = [{ name: directorySchool.name }];
  if (directorySchool.code) clauses.push({ code: directorySchool.code });
  const school = await School.findOne({
    where: {
      [Op.or]: clauses,
      logo_path: { [Op.ne]: null },
    },
    attributes: ['id', 'logo_path'],
  });
  if (!school || !school.logo_path) return null;
  const schoolLogoUpload = require('./schoolLogoUpload');
  const source = schoolLogoUpload.absolutePath(school.logo_path);
  if (!fs.existsSync(source)) return null;
  const buffer = fs.readFileSync(source);
  if (!imageKind(buffer)) return null;
  return saveBuffer(directorySchool.id, buffer, extensionOf(school.logo_path) || '.jpg');
}

async function discoverFromWebsite(directorySchool) {
  if (!directorySchool.website) return null;
  const page = await fetchPage(directorySchool.website);
  const html = page.body.toString('utf8');
  const baseUrl = page.url || directorySchool.website;
  const candidates = collectLogoCandidates(html, baseUrl);
  for (const candidate of candidates.slice(0, 4)) {
    const image = await downloadPreferredImage(candidate.url);
    if (image) return saveBuffer(directorySchool.id, image.buffer, image.ext);
  }
  return null;
}

async function discoverAndStore(directorySchool) {
  let stored = null;
  try {
    stored = await copyFromTenantSchool(directorySchool);
  } catch {
    stored = null;
  }
  if (!stored) {
    try {
      stored = await discoverFromWebsite(directorySchool);
    } catch {
      stored = null;
    }
  }

  const previous = directorySchool.logo_path;
  await directorySchool.update({
    logo_path: stored || null,
    logo_checked_at: new Date(),
  });
  if (previous && previous !== stored) removeStoredFile(previous);
  return stored;
}

function hasFreshNegativeCache(school) {
  if (school.logo_path) return false;
  if (!school.logo_checked_at) return false;
  const checked = new Date(school.logo_checked_at).getTime();
  if (!Number.isFinite(checked)) return false;
  return Date.now() - checked < RETRY_AFTER_MS;
}

async function ensureDirectorySchoolLogo(school) {
  if (school.logo_path && fs.existsSync(absolutePath(school.logo_path))) {
    return school.logo_path;
  }
  if (hasFreshNegativeCache(school)) return null;

  const key = String(school.id);
  if (inFlight.has(key)) return inFlight.get(key);

  const job = withFetchLimit(() => discoverAndStore(school)).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, job);
  return job;
}

function logoUrlFor(school) {
  return `/api/geo/directory-schools/${school.id}/logo`;
}

module.exports = {
  UPLOAD_ROOT,
  absolutePath,
  mimeTypeFor,
  ensureDirectorySchoolLogo,
  logoUrlFor,
};
