'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const https = require('https');
const { URL, URLSearchParams } = require('url');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MIN_PASSWORD_LEN = 8;

function driveTimeoutMs() {
  const parsed = Number(process.env.BACKUP_DRIVE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30 * 60 * 1000;
}

function folderIdProblem(folderId) {
  if (!folderId) return 'GOOGLE_DRIVE_FOLDER_ID';
  if (/^drive-klasor-id$/i.test(folderId)) {
    return 'GOOGLE_DRIVE_FOLDER_ID (örnek metin; Drive klasör adresindeki gerçek kimlik gerekli)';
  }
  return null;
}

function describeDriveConfig() {
  const password = process.env.BACKUP_ENCRYPTION_PASSWORD || '';
  const folderId = String(process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const oauthReady = Boolean(
    String(process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim() &&
      String(process.env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim() &&
      String(process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '').trim()
  );
  const serviceAccount = inspectServiceAccount();
  const mentioned = Boolean(
    password.trim() ||
      folderId ||
      process.env.GOOGLE_DRIVE_CLIENT_ID ||
      process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
  );
  if (!mentioned) return { mode: 'off' };

  const missing = [];
  if (!password.trim()) missing.push('BACKUP_ENCRYPTION_PASSWORD');
  else if (password.length < MIN_PASSWORD_LEN) missing.push(`BACKUP_ENCRYPTION_PASSWORD (en az ${MIN_PASSWORD_LEN} karakter)`);
  const folderProblem = folderIdProblem(folderId);
  if (folderProblem) missing.push(folderProblem);
  if (!oauthReady && !serviceAccount.ok) {
    missing.push(serviceAccount.reason || 'GOOGLE_DRIVE_REFRESH_TOKEN veya GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
  }
  if (missing.length) return { mode: 'incomplete', missing };
  return {
    mode: 'ready',
    password,
    folderId,
    auth: oauthReady ? 'oauth' : 'service_account',
  };
}

function inspectServiceAccount() {
  const raw = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return { ok: false, reason: null };
  try {
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(fs.readFileSync(raw, 'utf8'));
    if (!json.client_email || !json.private_key) {
      return { ok: false, reason: 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (client_email ve private_key gerekli)' };
    }
    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON okunamadı' };
  }
}

function loadServiceAccount() {
  const raw = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || '').trim();
  const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(fs.readFileSync(raw, 'utf8'));
  if (!json.client_email || !json.private_key) {
    throw new Error('Servis hesabı JSON içinde client_email ve private_key olmalı');
  }
  return json;
}

function httpsBuffer({ method, url, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        method,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs || driveTimeoutMs(), () => {
      req.destroy(new Error('Google Drive isteği zaman aşımına uğradı'));
    });
    if (body) req.end(body);
    else req.end();
  });
}

function putFile(url, filePath, size, token) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        method: 'PUT',
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Length': size,
          'Content-Type': 'application/octet-stream',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(driveTimeoutMs(), () => {
      req.destroy(new Error('Google Drive yüklemesi zaman aşımına uğradı'));
    });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      req.destroy(err);
    });
    stream.pipe(req);
  });
}

function parseJson(buf) {
  const text = buf.toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 400) };
  }
}

function googleMessage(status, json) {
  if (json && typeof json.error === 'object' && json.error) return json.error.message || `Google Drive HTTP ${status}`;
  if (typeof json.error === 'string') return json.error_description || json.error;
  if (json.raw) return json.raw;
  return `Google Drive HTTP ${status}`;
}

async function postForm(url, fields) {
  const body = new URLSearchParams(fields).toString();
  const res = await httpsBuffer({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
    timeoutMs: 30000,
  });
  const json = parseJson(res.body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(googleMessage(res.status, json));
  }
  return json;
}

async function getAccessToken(auth) {
  if (auth === 'oauth') {
    const json = await postForm(TOKEN_URL, {
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    });
    if (!json.access_token) throw new Error('Google access token alınamadı');
    return json.access_token;
  }
  const account = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const assertion = `${header}.${payload}.${signer.sign(account.private_key, 'base64url')}`;
  const json = await postForm(TOKEN_URL, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  if (!json.access_token) throw new Error('Google access token alınamadı');
  return json.access_token;
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveJson(method, url, token, body) {
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  const res = await httpsBuffer({
    method,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload
        ? { 'Content-Type': 'application/json; charset=UTF-8', 'Content-Length': payload.length }
        : {}),
    },
    body: payload,
  });
  const json = parseJson(res.body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(googleMessage(res.status, json));
  }
  return { status: res.status, headers: res.headers, json };
}

async function listFolderFiles(token, folderId) {
  const files = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,createdTime,size)',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const { json } = await driveJson('GET', `https://www.googleapis.com/drive/v3/files?${params}`, token);
    if (Array.isArray(json.files)) files.push(...json.files);
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return files;
}

function scheduledEncPattern(dbSlug) {
  const db = String(dbSlug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${db}_\\d{8}_\\d{6}\\.sql\\.gz\\.enc$`);
}

async function pruneDriveBackups({ token, folderId, dbSlug, retentionDays, minKeep, protectedName }) {
  const pattern = scheduledEncPattern(dbSlug);
  const cutoff = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;
  const candidates = (await listFolderFiles(token, folderId))
    .filter((file) => pattern.test(file.name || ''))
    .map((file) => ({
      id: file.id,
      name: file.name,
      time: Date.parse(file.createdTime) || 0,
    }))
    .sort((a, b) => b.time - a.time);
  const removable = candidates
    .slice(Math.max(0, Number(minKeep) || 0))
    .filter((file) => file.time < cutoff && file.name !== protectedName);
  const pruned = [];
  for (const file of removable) {
    await driveJson(
      'DELETE',
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`,
      token
    );
    pruned.push(file.name);
  }
  return pruned;
}

async function uploadEncryptedBackup({ filePath, remoteName, folderId, auth, retentionDays, dbSlug, minKeep }) {
  const token = await getAccessToken(auth);
  const size = (await fsp.stat(filePath)).size;
  const meta = JSON.stringify({ name: remoteName, parents: [folderId] });
  const init = await httpsBuffer({
    method: 'POST',
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'Content-Length': Buffer.byteLength(meta),
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': String(size),
    },
    body: meta,
  });
  if (init.status < 200 || init.status >= 300) {
    throw new Error(googleMessage(init.status, parseJson(init.body)));
  }
  const session = init.headers.location;
  if (!session || Array.isArray(session)) {
    throw new Error('Google Drive yükleme oturumu alınamadı');
  }
  const uploaded = await putFile(session, filePath, size, token);
  if (uploaded.status < 200 || uploaded.status >= 300) {
    throw new Error(googleMessage(uploaded.status, parseJson(uploaded.body)));
  }
  let pruned = [];
  let pruneError = null;
  try {
    pruned = await pruneDriveBackups({
      token,
      folderId,
      dbSlug,
      retentionDays,
      minKeep,
      protectedName: remoteName,
    });
  } catch (err) {
    pruneError = err.message;
  }
  return { pruned, pruneError };
}

module.exports = {
  describeDriveConfig,
  uploadEncryptedBackup,
};
