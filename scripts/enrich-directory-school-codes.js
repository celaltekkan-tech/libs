'use strict';

/**
 * MEB "Tüm Okullar" CSV'lerindeki YOL alanından 6 haneli kurum kodunu
 * directory-schools seed dosyasına işler.
 *
 *   node scripts/enrich-directory-school-codes.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'src', 'seed-data', 'geo', 'directory-schools.json.gz');
const TREE_URL =
  'https://api.github.com/repos/MehmetHuseyinDelipalta/MEB-Okul-Veritabani/git/trees/main?recursive=1';
const RAW_BASE =
  'https://raw.githubusercontent.com/MehmetHuseyinDelipalta/MEB-Okul-Veritabani/main/';

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lise-idari-geo-seed', Accept: 'application/vnd.github+json' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeName(value) {
  return String(value || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function hostKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return url.hostname.replace(/^www\./i, '').replace(/\.meb\.k12\.tr$/i, '').toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\.meb\.k12\.tr.*$/i, '')
      .toLowerCase();
  }
}

function codeFromYol(yol) {
  const last = String(yol || '').split('/').pop() || '';
  return /^\d{6}$/.test(last) ? last : null;
}

async function loadCodeMaps() {
  console.log('GitHub ağacı alınıyor...');
  const tree = JSON.parse((await download(TREE_URL)).toString('utf8'));
  const files = (tree.tree || []).filter((item) => {
    if (item.type !== 'blob') return false;
    const parts = String(item.path || '').split('/');
    return parts.length === 3 && parts[0] === 'Tüm Okullar' && parts[2].endsWith(' - Tüm Okullar.csv');
  });
  console.log(`il CSV: ${files.length}`);

  const byHost = new Map();
  const byName = new Map();
  let parsed = 0;
  let withCode = 0;

  for (const file of files) {
    const url = RAW_BASE + file.path.split('/').map(encodeURIComponent).join('/');
    process.stdout.write(`  ${file.path}\n`);
    let text;
    try {
      text = (await download(url)).toString('utf8');
    } catch (err) {
      console.warn(`  atlandı: ${err.message}`);
      continue;
    }
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) continue;
    const header = parseCsvLine(lines[0]).map((h) => h.trim());
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line);
      const code = codeFromYol(cols[idx.YOL]);
      if (!code) continue;
      withCode += 1;
      parsed += 1;
      const host = hostKey(cols[idx.WEBSITE] || cols[idx.HOST]);
      const nameKey = `${normalizeName(cols[idx.IL])}|${normalizeName(cols[idx.ILCE])}|${normalizeName(cols[idx.OKUL_ADI])}`;
      if (host && !byHost.has(host)) byHost.set(host, code);
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, code);
    }
  }

  console.log(`kodlu satır: ${withCode}, host map: ${byHost.size}, ad map: ${byName.size}`);
  return { byHost, byName };
}

function loadProvinces() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src', 'seed-data', 'geo', 'provinces.json'), 'utf8')
  );
}

function loadDistricts() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src', 'seed-data', 'geo', 'districts.json'), 'utf8')
  );
}

async function main() {
  const schools = JSON.parse(zlib.gunzipSync(fs.readFileSync(OUT_FILE)).toString('utf8'));
  const { byHost, byName } = await loadCodeMaps();
  const provinces = new Map(loadProvinces().map((p) => [p.id, p]));
  const districts = new Map(loadDistricts().map((d) => [d.id, d]));

  let matched = 0;
  let byHostCount = 0;
  let byNameCount = 0;
  for (const school of schools) {
    const host = hostKey(school.website);
    let code = host ? byHost.get(host) : null;
    if (code) byHostCount += 1;
    if (!code) {
      const province = provinces.get(school.province_id);
      const district = school.district_id ? districts.get(school.district_id) : null;
      const nameKey = `${normalizeName(province && province.name)}|${normalizeName(district && district.name)}|${normalizeName(school.name)}`;
      code = byName.get(nameKey) || null;
      if (code) byNameCount += 1;
    }
    school.code = code || null;
    if (code) matched += 1;
  }

  const gz = zlib.gzipSync(JSON.stringify(schools), { level: 9 });
  fs.writeFileSync(OUT_FILE, gz);
  console.log(
    `eşleşen kod: ${matched}/${schools.length} (host=${byHostCount}, ad=${byNameCount}) gzip=${gz.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
