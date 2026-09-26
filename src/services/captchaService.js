'use strict';

const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 5;
const MAX_STORE = 5000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** id -> { hash, exp } */
const store = new Map();

function purge(now = Date.now()) {
  for (const [id, row] of store) {
    if (row.exp <= now) store.delete(id);
  }
  while (store.size > MAX_STORE) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clampEase(ease) {
  const n = Number(ease);
  if (n === 1 || n === 2) return n;
  return 0;
}

function renderSvg(code, ease) {
  const width = 128;
  const height = 40;
  const level = clampEase(ease);
  let noise = '';
  let glyphs = '';

  if (level === 0) {
    const step = 16;
    const start = (width - (code.length - 1) * step) / 2;
    for (let i = 0; i < 4; i += 1) {
      const y = 8 + i * 8 + Math.random() * 3;
      noise += `<path d="M2 ${y.toFixed(1)} Q ${width / 2} ${(y + (Math.random() * 8 - 4)).toFixed(1)} ${width - 2} ${y.toFixed(1)}" fill="none" stroke="#8fa6bf" stroke-width="1.7"/>`;
    }
    for (let i = 0; i < code.length; i += 1) {
      const x = start + i * step + (Math.random() * 10 - 5);
      const y = 26 + (Math.random() * 10 - 5);
      const rot = (Math.random() * 22 - 11).toFixed(1);
      glyphs += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#1d4e89" font-size="16" font-family="Segoe UI, system-ui, sans-serif" font-weight="600" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})">${escapeXml(code[i])}</text>`;
    }
  } else if (level === 1) {
    const yLine = 14 + Math.random() * 12;
    noise += `<path d="M4 ${yLine.toFixed(1)} Q ${width / 2} ${(yLine + 3).toFixed(1)} ${width - 4} ${yLine.toFixed(1)}" fill="none" stroke="#c5d0e0" stroke-width="0.7"/>`;
    for (let i = 0; i < code.length; i += 1) {
      const x = 12 + i * 22;
      const y = 26 + (Math.random() * 3 - 1.5);
      const rot = (Math.random() * 12 - 6).toFixed(1);
      glyphs += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#1d4e89" font-size="16" font-family="Segoe UI, system-ui, sans-serif" font-weight="600" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})">${escapeXml(code[i])}</text>`;
    }
  } else {
    for (let i = 0; i < code.length; i += 1) {
      const x = 14 + i * 21;
      glyphs += `<text x="${x}" y="26" fill="#163a66" font-size="17" font-family="Segoe UI, system-ui, sans-serif" font-weight="700">${escapeXml(code[i])}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="6" fill="#f7f9fc"/>${noise}${glyphs}</svg>`;
}

function createCaptcha(ease) {
  purge();
  const code = randomCode();
  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { hash: hashCode(code), exp: Date.now() + TTL_MS });
  return { id, svg: renderSvg(code, ease) };
}

function verifyCaptcha(id, answer) {
  purge();
  const key = String(id || '');
  const row = store.get(key);
  if (!row) return false;
  store.delete(key);
  if (row.exp <= Date.now()) return false;
  const given = hashCode(answer || '');
  if (given.length !== row.hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(row.hash));
}

module.exports = {
  createCaptcha,
  verifyCaptcha,
};
