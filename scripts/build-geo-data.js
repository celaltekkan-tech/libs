'use strict';

/**
 * TurkiyeAPI il/ilçe seti + MEB okul CSV'sinden seed JSON üretir.
 * Ham dosyalar yoksa kaynaklardan indirir.
 *
 *   node scripts/build-geo-data.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'src', 'data');
const OUT_DIR = path.join(ROOT, 'src', 'seed-data', 'geo');

const SOURCES = {
  provinces: 'https://api.turkiyeapi.dev/v2/datasets/2025/provinces.json',
  districts: 'https://api.turkiyeapi.dev/v2/datasets/2025/districts.json',
  schools: 'https://raw.githubusercontent.com/ensarkovankaya/meb-okullar/master/meb-okullar.csv',
};

const DISTRICT_ALIASES = {
  eyup: 'eyupsultan',
  dogubeyazit: 'dogubayazit',
  beytussebab: 'beytussebap',
  dilovali: 'dilovasi',
  ondokuzmayis: '19mayis',
  cagliyancerit: 'caglayancerit',
  afyon: 'afyonkarahisar',
};

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'lise-idari-geo-seed' } }, (res) => {
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

async function ensureRaw(name, url, filename) {
  const dest = path.join(RAW_DIR, filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`ham dosya var: ${filename}`);
    return dest;
  }
  fs.mkdirSync(RAW_DIR, { recursive: true });
  console.log(`indiriliyor: ${name}`);
  const buf = await download(url);
  fs.writeFileSync(dest, buf);
  console.log(`yazıldı: ${filename} (${buf.length} bayt)`);
  return dest;
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
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function mapSchoolType(tip, name) {
  const t = normalizeName(tip);
  const n = normalizeName(name);
  if (t === 'ortaokul' || n.includes('ortaokul') || n.includes('imamhatiportaokulu')) return 'ortaokul';
  if (
    t === 'lise' ||
    t === 'mesleklisesi' ||
    n.includes('lisesi') ||
    n.includes('lise') ||
    n.includes('meslekiveteknik')
  ) {
    return 'lise';
  }
  return null;
}

function findDistrict(province, ilceName, byProvince) {
  const list = byProvince.get(province.id) || [];
  const raw = String(ilceName || '').trim();
  const n = normalizeName(raw);
  if (!n) return null;

  const exact = list.find((d) => normalizeName(d.name) === n);
  if (exact) return exact;

  const aliasKey = DISTRICT_ALIASES[n];
  if (aliasKey) {
    const aliased = list.find((d) => normalizeName(d.name) === aliasKey);
    if (aliased) return aliased;
  }

  if (n === 'merkez' || n === normalizeName(province.name)) {
    const sameName = list.find((d) => normalizeName(d.name) === normalizeName(province.name));
    if (sameName) return sameName;
  }

  return null;
}

async function main() {
  await ensureRaw('provinces', SOURCES.provinces, 'provinces.raw.json');
  await ensureRaw('districts', SOURCES.districts, 'districts.raw.json');
  await ensureRaw('schools', SOURCES.schools, 'meb-okullar.raw.csv');

  const rawProvinces = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'provinces.raw.json'), 'utf8'));
  const rawDistricts = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'districts.raw.json'), 'utf8'));

  const provinces = rawProvinces.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    region: p.region && p.region.tr ? p.region.tr : null,
  }));
  provinces.sort((a, b) => a.id - b.id);

  const districts = rawDistricts.map((d) => ({
    id: d.id,
    province_id: d.provinceId,
    name: d.name,
    slug: d.slug,
  }));
  districts.sort((a, b) => a.province_id - b.province_id || a.name.localeCompare(b.name, 'tr'));

  const provinceById = new Map(provinces.map((p) => [p.id, p]));
  const byProvince = new Map();
  for (const d of districts) {
    if (!byProvince.has(d.province_id)) byProvince.set(d.province_id, []);
    byProvince.get(d.province_id).push(d);
  }

  const csv = fs.readFileSync(path.join(RAW_DIR, 'meb-okullar.raw.csv'), 'utf8');
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const schools = [];
  const seen = new Set();
  const unmatched = new Map();
  let skippedType = 0;
  let skippedDup = 0;

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const provinceId = Number(cols[idx.il_kodu]);
    const province = provinceById.get(provinceId);
    if (!province) continue;

    const name = String(cols[idx.okul_adi] || '').trim();
    const tip = String(cols[idx.tip] || '').trim();
    const schoolType = mapSchoolType(tip, name);
    if (!schoolType || !name) {
      skippedType += 1;
      continue;
    }

    const ilceName = String(cols[idx.ilce_adi] || '').trim();
    const district = findDistrict(province, ilceName, byProvince);
    if (!district) {
      const key = `${province.name}|${ilceName}`;
      unmatched.set(key, (unmatched.get(key) || 0) + 1);
    }

    const districtId = district ? district.id : null;
    const dedupe = `${provinceId}|${districtId || 0}|${normalizeName(name)}|${schoolType}`;
    if (seen.has(dedupe)) {
      skippedDup += 1;
      continue;
    }
    seen.add(dedupe);

    const website = String(cols[idx.okul_website] || '').trim() || null;
    schools.push({
      name,
      province_id: provinceId,
      district_id: districtId,
      school_type: schoolType,
      website,
    });
  }

  schools.sort(
    (a, b) =>
      a.province_id - b.province_id ||
      String(a.district_id || 0) - String(b.district_id || 0) ||
      a.name.localeCompare(b.name, 'tr')
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'provinces.json'), `${JSON.stringify(provinces, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'districts.json'), `${JSON.stringify(districts, null, 2)}\n`);
  const gz = zlib.gzipSync(JSON.stringify(schools), { level: 9 });
  fs.writeFileSync(path.join(OUT_DIR, 'directory-schools.json.gz'), gz);

  const orta = schools.filter((s) => s.school_type === 'ortaokul').length;
  const lise = schools.filter((s) => s.school_type === 'lise').length;
  const unmatchedRows = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`iller: ${provinces.length}`);
  console.log(`ilçeler: ${districts.length}`);
  console.log(`okullar: ${schools.length} (ortaokul=${orta}, lise=${lise})`);
  console.log(`tip atlanan: ${skippedType}, mükerrer: ${skippedDup}`);
  console.log(`ilçe eşleşmeyen grup: ${unmatchedRows.length}`);
  unmatchedRows.slice(0, 25).forEach(([key, count]) => console.log(`  ${count}\t${key}`));
  console.log(`gzip: ${gz.length} bayt -> ${path.relative(ROOT, path.join(OUT_DIR, 'directory-schools.json.gz'))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
