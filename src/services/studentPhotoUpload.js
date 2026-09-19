'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'students');

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionOf(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

function isAllowedFile(file) {
  const ext = extensionOf(file.originalname);
  return ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(file.mimetype);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAllowedFile(file)) {
      const err = new Error('Yalnızca PNG, JPG veya WEBP resim dosyaları yüklenebilir');
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

function saveBuffer(studentId, file) {
  ensureUploadDir();
  const ext = extensionOf(file.originalname) || '.jpg';
  const storedName = `student-${studentId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(absolutePath(storedName), file.buffer);
  return storedName;
}

function removeStoredFile(storedName) {
  if (!storedName) return;
  try {
    fs.unlinkSync(absolutePath(storedName));
  } catch {
    // dosya yoksa sessizce geç
  }
}

function mimeTypeFor(storedName) {
  const ext = extensionOf(storedName);
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

module.exports = {
  UPLOAD_ROOT,
  MAX_FILE_SIZE,
  upload,
  ensureUploadDir,
  absolutePath,
  saveBuffer,
  removeStoredFile,
  mimeTypeFor,
};
