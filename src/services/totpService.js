const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

authenticator.options = { window: 1 };

const ISSUER = process.env.TOTP_ISSUER || 'Okul Idare Sistemi';
const BACKUP_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 10;

function generateSecret() {
  return authenticator.generateSecret();
}

function buildOtpauthUrl(secret, email) {
  return authenticator.keyuri(email, ISSUER, secret);
}

async function buildQrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const normalized = String(token).replace(/\s+/g, '');
  return authenticator.verify({ token: normalized, secret });
}

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    codes.push(crypto.randomBytes(4).toString('hex'));
  }
  return codes;
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)));
}

async function consumeBackupCode(hashedCodes, plainCode) {
  if (!Array.isArray(hashedCodes) || !plainCode) {
    return { ok: false, remaining: hashedCodes || [] };
  }

  const normalized = String(plainCode).replace(/\s+/g, '').toLowerCase();
  const remaining = [];
  let matched = false;

  for (const hash of hashedCodes) {
    if (!matched && (await bcrypt.compare(normalized, hash))) {
      matched = true;
      continue;
    }
    remaining.push(hash);
  }

  return { ok: matched, remaining };
}

module.exports = {
  generateSecret,
  buildOtpauthUrl,
  buildQrDataUrl,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
};
