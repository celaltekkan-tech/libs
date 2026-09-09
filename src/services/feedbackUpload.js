'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'feedback');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // bazı istemciler office dosyalarını generic gönderir
  'application/octet-stream',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionOf(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

function isAllowedFile(file) {
  const ext = extensionOf(file.originalname);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return false;
  // octet-stream yalnızca bilinen uzantılarla kabul edilir (yukarıda uzantı kontrolü var)
  return true;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_ROOT);
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = extensionOf(file.originalname) || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (!isAllowedFile(file)) {
      const err = new Error('Yalnızca PDF ve Ofis dosyaları yüklenebilir (pdf, doc, docx, xls, xlsx, ppt, pptx)');
      err.status = 400;
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

function absolutePath(storedName) {
  return path.join(UPLOAD_ROOT, path.basename(storedName));
}

function removeStoredFile(storedName) {
  if (!storedName) return;
  try {
    fs.unlinkSync(absolutePath(storedName));
  } catch {
    // dosya yoksa sessizce geç
  }
}

function serializeAttachment(row) {
  return {
    id: row.id,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
  };
}

function inlineDisposition(mimeType) {
  return mimeType === 'application/pdf' ? 'inline' : 'attachment';
}

module.exports = {
  UPLOAD_ROOT,
  MAX_FILES,
  MAX_FILE_SIZE,
  upload,
  ensureUploadDir,
  absolutePath,
  removeStoredFile,
  serializeAttachment,
  inlineDisposition,
  ALLOWED_EXTENSIONS,
};
