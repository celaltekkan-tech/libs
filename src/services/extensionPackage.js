'use strict';

const fs = require('fs');
const path = require('path');

const EXTENSION_DIR = path.join(__dirname, '../../extension');
const CRX_PATH = path.join(__dirname, '../../extension-dist/oids-eokul.crx');
/** manifest.json içindeki anahtardan üretilen sabit kimlik. */
const EXTENSION_ID = 'pgahffkffoibfbfdfblffjdfcjoabhkf';
const PRODUCTION_API = 'https://api.oids.com.tr';

const INSTALL_NOTE = [
  'OIDS e-Okul eklentisini böyle kurun:',
  '',
  '1. Bu zip’i ayıklayın (sağ tık > Tümünü ayıkla). Zip dosyasını Chrome’a vermeyin.',
  '2. Chrome adres çubuğuna chrome://extensions yazın.',
  '3. Sağ üstten Geliştirici modunu açın.',
  '4. Paketlenmemiş öğe yükle deyip BU KLASÖRÜ seçin. Klasörün içinde manifest.json görünmeli.',
  '5. OIDS otomatik ders programı sayfasını yenileyin, sonra programı eklentiye yükleyin.',
  '',
  'Güncelleme: Yeni zip’i aynı klasörün üzerine ayıklayın, chrome://extensions sayfasında Yenile’ye basın.',
  '',
].join('\n');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[n] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function listFiles(dir, prefix, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) listFiles(full, rel, out);
    else out.push({ name: rel, data: fs.readFileSync(full) });
  }
  return out;
}

function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** Sıkıştırmadan zip üretir. Kök klasör, Chrome'un paketlenmemiş yüklemede seçtiği klasördür. */
function buildExtensionZip() {
  if (!fs.existsSync(path.join(EXTENSION_DIR, 'manifest.json'))) {
    const err = new Error('Eklenti paketi sunucuda bulunamadı');
    err.status = 500;
    throw err;
  }
  const files = listFiles(EXTENSION_DIR, '', []);
  files.push({ name: 'KURULUM.txt', data: Buffer.from(INSTALL_NOTE, 'utf8') });
  const { time, day } = dosStamp(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return Buffer.concat([...locals, centralDir, end]);
}

function readManifest() {
  const file = path.join(EXTENSION_DIR, 'manifest.json');
  if (!fs.existsSync(file)) {
    const err = new Error('Eklenti paketi sunucuda bulunamadı');
    err.status = 500;
    throw err;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function compareVersions(left, right) {
  const a = String(left || '')
    .split('.')
    .map((part) => Number(part) || 0);
  const b = String(right || '')
    .split('.')
    .map((part) => Number(part) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta) return delta < 0 ? -1 : 1;
  }
  return 0;
}

function publicApiBase(req) {
  const fromEnv = String(process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if ((process.env.NODE_ENV || 'development') === 'production') return PRODUCTION_API;
  if (!req) return PRODUCTION_API;
  const host = req.get('host');
  if (!host) return PRODUCTION_API;
  return `${req.protocol || 'http'}://${host}`;
}

function getExtensionInfo(req) {
  const manifest = readManifest();
  const base = publicApiBase(req);
  return {
    id: EXTENSION_ID,
    name: manifest.name,
    version: String(manifest.version || ''),
    min_version: String(manifest.version || ''),
    download_url: `${base}/api/extension/oids-eokul-eklentisi.zip`,
    update_url: `${base}/api/extension/updates.xml`,
    crx_url: fs.existsSync(CRX_PATH) ? `${base}/api/extension/package.crx` : null,
  };
}

function buildUpdateXml(req) {
  const info = getExtensionInfo(req);
  const codebase = info.crx_url || info.download_url;
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    "<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>",
    `  <app appid='${info.id}'>`,
    `    <updatecheck codebase='${codebase}' version='${info.version}' />`,
    '  </app>',
    '</gupdate>',
    '',
  ].join('\n');
}

function readCrx() {
  if (!fs.existsSync(CRX_PATH)) {
    const err = new Error('İmzalı eklenti paketi henüz yayınlanmadı');
    err.status = 404;
    throw err;
  }
  return fs.readFileSync(CRX_PATH);
}

module.exports = {
  EXTENSION_ID,
  buildExtensionZip,
  buildUpdateXml,
  compareVersions,
  getExtensionInfo,
  readCrx,
  readManifest,
};
