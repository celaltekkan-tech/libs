'use strict';

const XLSX = require('xlsx');
const { normalizeKariyer } = require('../utils/teacherTitle');

// MEBBİS "Personel Listesi Özet Bilgiler" dökümü, her personel için birden
// fazla satıra yayılmış, birleştirilmiş (merge) hücrelerden oluşan bir form
// çıktısıdır. Alanların hangi sütunda olduğu ki̇şiden ki̇şiye kayabiliyor
// (metin uzunluğuna göre farklı birleştirme genişlikleri), bu yüzden sabit
// sütun indeksi yerine satırdaki DOLU hücrelerin SIRASINA ve İÇERİK türüne
// göre eşleştirme yapılıyor — bu, dosyanın gerçek örnekleriyle doğrulanmıştır.

const EDU_KEYWORDS = /(Lisans|Lise|Ön ?Lisans|Doktora|Ortaokul|İlkokul|Yüksek ?Lisans)/i;
const DURUM_RE = /^(Görevde|Emekli|Ayrılmış|Açıkta|Aday|Ücretsiz İzinde|İzinde)\s+(\d+)-(\d+)$/i;
const BLOOD_RE = /^(0|A|B|AB)\s*Rh\s*\([+-]\)$/i;
const TCKN_RE = /\((\d{9,11})\)/;
const KURUM_INFO_RE = /^(.*?)\s*\/\s*([\w-]+)\s*\/\s*(\d{2}\/\d{2}\/\d{4})\s*$/;

function toDMYToISO(dmy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || '');
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function excelDateToISO(serial) {
  if (typeof serial !== 'number') return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
}

function nonEmptyValues(row) {
  return (row || []).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
}

function guessPersonnelType(gorev) {
  const g = String(gorev || '');
  if (/Öğretmen|Müdür/i.test(g)) return 'ogretmen';
  if (/Aşçı|Hizmetli|Kaloriferci|Bekçi|Temizlik|Bahçıvan/i.test(g)) return 'isci';
  return 'memur';
}

function parseHeaderRow(row) {
  const vals = nonEmptyValues(row);
  if (vals.length < 5) return null;
  const [ilIlce, kurumInfo, nameT, unvanGorev, bransSeviye] = vals;

  const tcknMatch = TCKN_RE.exec(String(nameT));
  if (!tcknMatch) return null;
  const nationalId = tcknMatch[1];
  const fullName = String(nameT).replace(TCKN_RE, '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ');

  const kurumMatch = KURUM_INFO_RE.exec(String(kurumInfo));
  const kurumAdi = kurumMatch ? kurumMatch[1].trim() : String(kurumInfo).trim();
  const kurumKodu = kurumMatch ? kurumMatch[2] : null;
  const kurumBaslamaTarihi = kurumMatch ? toDMYToISO(kurumMatch[3]) : null;

  const [unvan, gorev] = String(unvanGorev).split('/').map((s) => s.trim());
  const [brans, seviyeUnvani] = String(bransSeviye).split('/').map((s) => s.trim());
  const personnelType = guessPersonnelType(gorev);

  return {
    il_ilce: String(ilIlce).trim(),
    kurum_adi: kurumAdi,
    kurum_kodu: kurumKodu,
    kurum_baslama_tarihi: kurumBaslamaTarihi,
    first_name: firstName,
    last_name: lastName,
    national_id: nationalId,
    unvan: unvan || null,
    gorev: gorev || null,
    brans: brans || null,
    seviye_unvani: seviyeUnvani || null,
    kariyer: personnelType === 'ogretmen' ? normalizeKariyer(seviyeUnvani) : null,
    personnel_type: personnelType,
  };
}

function parseEduRow(row) {
  const vals = nonEmptyValues(row);
  if (vals.length < 6) return null;
  if (!EDU_KEYWORDS.test(String(vals[0]))) return null;

  let idx = 0;
  const ogrenimDurumu = String(vals[idx]);
  idx += 1;
  const kurumSicilNo = vals[idx] != null ? String(vals[idx]) : null;
  idx += 1;
  const emekliSicilNo = vals[idx] != null ? String(vals[idx]) : null;
  idx += 1;
  const arsivNo = vals[idx] != null ? String(vals[idx]) : null;
  idx += 1;
  const cinsiyet = vals[idx] != null ? String(vals[idx]) : null;
  idx += 1;

  let kanGrubu = null;
  if (vals[idx] != null && BLOOD_RE.test(String(vals[idx]))) {
    kanGrubu = String(vals[idx]);
    idx += 1;
  }

  const dogumTarihi = excelDateToISO(vals[idx]);
  idx += 1;
  const ilkGoreveBaslamaTarihi = excelDateToISO(vals[idx]);

  return {
    ogrenim_durumu: ogrenimDurumu,
    kurum_sicil_no: kurumSicilNo,
    emekli_sicil_no: emekliSicilNo,
    arsiv_no: arsivNo,
    cinsiyet,
    kan_grubu: kanGrubu,
    dogum_tarihi: dogumTarihi,
    ilk_gorev_tarihi: ilkGoreveBaslamaTarihi,
  };
}

function parseDurumRow(row) {
  const vals = nonEmptyValues(row);
  for (const v of vals) {
    const m = DURUM_RE.exec(String(v).trim());
    if (m) {
      return { durum: m[1], kademe: Number(m[2]), derece: Number(m[3]) };
    }
  }
  return null;
}

function parseMebbisWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdxs = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.some((v) => typeof v === 'string' && TCKN_RE.test(v))) headerIdxs.push(i);
  }

  const results = [];
  for (let h = 0; h < headerIdxs.length; h += 1) {
    const start = headerIdxs[h];
    const end = h + 1 < headerIdxs.length ? headerIdxs[h + 1] : rows.length;
    const header = parseHeaderRow(rows[start]);
    if (!header) continue;

    let edu = null;
    let durum = null;
    for (let r = start + 1; r < end; r += 1) {
      if (!edu) edu = parseEduRow(rows[r]);
      if (!durum) durum = parseDurumRow(rows[r]);
      if (edu && durum) break;
    }

    results.push({
      row_index: start,
      ...header,
      ...(edu || {}),
      ...(durum || {}),
    });
  }

  return results;
}

module.exports = { parseMebbisWorkbook };
