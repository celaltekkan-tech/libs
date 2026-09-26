'use strict';

const XLSX = require('xlsx');

const IMPORTABLE_FIELDS = [
  { key: 'row_no', label: 'Sıra No', required: false },
  { key: 'student_number', label: 'Öğrenci No', required: true },
  { key: 'national_id', label: 'T.C. Kimlik No', required: false },
  { key: 'first_name', label: 'Ad', required: true },
  { key: 'last_name', label: 'Soyad', required: true },
  { key: 'class_level', label: 'Sınıf', required: false },
  { key: 'section', label: 'Şube', required: false },
  { key: 'gender', label: 'Cinsiyet', required: false },
  { key: 'birth_date', label: 'Doğum Tarihi', required: false },
  { key: 'yasi', label: 'Yaşı', required: false },
  { key: 'registration_status', label: 'Kayıt Durumu', required: false },
  { key: 'parent_name', label: 'Veli Adı', required: false },
  { key: 'mother_name', label: 'Anne Adı', required: false },
  { key: 'father_name', label: 'Baba Adı', required: false },
  { key: 'parent_phone', label: 'Veli Telefon', required: false },
  { key: 'student_phone', label: 'Öğrenci Telefon', required: false },
  { key: 'is_inclusion', label: 'Kaynaştırma', required: false },
  { key: 'is_foreign', label: 'Yabancı Uyruklu', required: false },
  { key: 'boarding_status', label: 'Yurt Durumu', required: false },
];

const IMPORT_HEADER_MAP = {
  't.c. kimlik no': 'national_id',
  'tc kimlik no': 'national_id',
  'tc kimlik': 'national_id',
  'kimlik no': 'national_id',
  't.c. kimlik': 'national_id',
  'öğrenci no': 'student_number',
  'ogrenci no': 'student_number',
  'öğrenci numarası': 'student_number',
  'ogrenci numarasi': 'student_number',
  'okul no': 'student_number',
  's.no': 'row_no',
  's. no': 'row_no',
  's no': 'row_no',
  'sıra no': 'row_no',
  'sira no': 'row_no',
  'sıra': 'row_no',
  'sira': 'row_no',
  adı: 'first_name',
  adi: 'first_name',
  ad: 'first_name',
  'öğrenci adı': 'first_name',
  'ogrenci adi': 'first_name',
  soyadı: 'last_name',
  soyadi: 'last_name',
  soyad: 'last_name',
  'öğrenci soyadı': 'last_name',
  'ogrenci soyadi': 'last_name',
  sınıfı: 'class_level',
  sinifi: 'class_level',
  sınıf: 'class_level',
  sinif: 'class_level',
  'sınıf seviyesi': 'class_level',
  şubesi: 'section',
  subesi: 'section',
  şube: 'section',
  sube: 'section',
  'sınıf/şube': 'class_level',
  'sınıf / şube': 'class_level',
  'sınıf-şube': 'class_level',
  'sınıf şube': 'class_level',
  'sinif/sube': 'class_level',
  'sinif / sube': 'class_level',
  'sınıfı / şubesi': 'class_level',
  'sınıfı/şubesi': 'class_level',
  'sınıf - şube': 'class_level',
  cinsiyeti: 'gender',
  cinsiyet: 'gender',
  'doğum tarihi': 'birth_date',
  'dogum tarihi': 'birth_date',
  yasi: 'yasi',
  yaşı: 'yasi',
  yas: 'yasi',
  yaş: 'yasi',
  'öğrenci yaşı': 'yasi',
  'ogrenci yasi': 'yasi',
  'kayıt durumu': 'registration_status',
  'kayit durumu': 'registration_status',
  'veli adı': 'parent_name',
  'veli adi': 'parent_name',
  'veli adı soyadı': 'parent_name',
  'veli adi soyadi': 'parent_name',
  'anne adı': 'mother_name',
  'anne adi': 'mother_name',
  'anne adı soyadı': 'mother_name',
  'anne adi soyadi': 'mother_name',
  anneadi: 'mother_name',
  anneadı: 'mother_name',
  anne: 'mother_name',
  'ana adı': 'mother_name',
  'ana adi': 'mother_name',
  'ana adı soyadı': 'mother_name',
  'ana adi soyadi': 'mother_name',
  anaadi: 'mother_name',
  anaadı: 'mother_name',
  ana: 'mother_name',
  'baba adı': 'father_name',
  'baba adi': 'father_name',
  'baba adı soyadı': 'father_name',
  'baba adi soyadi': 'father_name',
  babaadi: 'father_name',
  babaadı: 'father_name',
  baba: 'father_name',
  'veli telefon': 'parent_phone',
  'veli telefonu': 'parent_phone',
  'öğrenci telefon': 'student_phone',
  'ogrenci telefon': 'student_phone',
  'öğrenci telefonu': 'student_phone',
  'ogrenci telefonu': 'student_phone',
  'öğrenci cep': 'student_phone',
  'öğrenci cep telefonu': 'student_phone',
  'ogrenci cep telefonu': 'student_phone',
  kaynaştırma: 'is_inclusion',
  kaynastirma: 'is_inclusion',
  'yabancı uyruklu': 'is_foreign',
  'yabanci uyruklu': 'is_foreign',
  'pansiyon durum': 'boarding_status',
  'pansiyon durumu': 'boarding_status',
  'yurt durumu': 'boarding_status',
};

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function cellToDisplay(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof value === 'object' && value.w != null) return String(value.w).trim() || null;
  if (typeof value === 'object' && value.text != null) return String(value.text).trim() || null;
  const str = String(value).trim();
  return str || null;
}

function isExcelFileName(name = '') {
  const lower = String(name).toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

function readSheetMatrix(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });
  if (!workbook.SheetNames.length) {
    const err = new Error('Excel dosyasında sayfa bulunamadı');
    err.status = 400;
    throw err;
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: true,
  });
  return {
    sheetNames: workbook.SheetNames,
    sheetName,
    matrix,
  };
}

function scoreHeaderRow(row, headerMap = IMPORT_HEADER_MAP, hintRegex = null) {
  if (!Array.isArray(row)) return 0;
  const hintKeys = new Set(Object.keys(headerMap));
  const defaultHint =
    /(ad|soyad|öğrenci|ogrenci|kimlik|şube|sube|sınıf|sinif|cinsiyet|doğum|dogum|anne|ana|baba|veli|ders|öğretmen|ogretmen|gün|gun|saat)/i;
  const hint = hintRegex || defaultHint;
  let score = 0;
  let nonEmpty = 0;
  row.forEach((cell) => {
    const label = cellToDisplay(cell);
    if (!label) return;
    nonEmpty += 1;
    const normalized = normalizeHeader(label);
    if (hintKeys.has(normalized) || headerMap[normalized]) score += 3;
    if (hint.test(label)) score += 1;
  });
  if (nonEmpty < 2) return 0;
  return score;
}

function detectHeaderRow(matrix, maxScan = 40, headerMap = IMPORT_HEADER_MAP, hintRegex = null) {
  let bestIdx = 0;
  let bestScore = 0;
  const limit = Math.min(matrix.length, maxScan);
  for (let i = 0; i < limit; i += 1) {
    const score = scoreHeaderRow(matrix[i], headerMap, hintRegex);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function extractHeaders(row) {
  if (!Array.isArray(row)) return [];
  const headers = [];
  row.forEach((cell, index) => {
    const label = cellToDisplay(cell);
    if (!label) return;
    headers.push({ index, label });
  });
  return headers;
}

function inferHeaderField(label, headerMap = IMPORT_HEADER_MAP) {
  const normalized = normalizeHeader(label);
  const compact = normalized.replace(/\s+/g, '');
  if (headerMap[normalized]) return headerMap[normalized];
  if (headerMap[compact]) return headerMap[compact];
  if (
    (/^(anne|ana)(adi|adı|adsoyadi|adisoyadi)?$/.test(compact) ||
      /\b(anne|ana)\b.*\bad/.test(normalized)) &&
    !/\bbaba\b/.test(normalized)
  ) {
    return 'mother_name';
  }
  if (/^baba(adi|adı|adsoyadi|adisoyadi)?$/.test(compact) || /\bbaba\b.*\bad/.test(normalized)) {
    return 'father_name';
  }
  return null;
}

function suggestMapping(headers, headerMap = IMPORT_HEADER_MAP) {
  const mapping = {};
  const usedFields = new Set();
  headers.forEach(({ index, label }) => {
    const field = inferHeaderField(label, headerMap);
    if (field && !usedFields.has(field)) {
      mapping[String(index)] = field;
      usedFields.add(field);
    }
  });
  return mapping;
}

function fillMissingMappedFields(columnMapping, headers, fields, headerMap = IMPORT_HEADER_MAP) {
  const mapping = { ...(columnMapping || {}) };
  const used = new Set(Object.values(mapping).filter(Boolean));
  const wanted = new Set(fields);
  (headers || []).forEach(({ index, label }) => {
    const key = String(index);
    if (mapping[key]) return;
    const field = inferHeaderField(label, headerMap);
    if (field && wanted.has(field) && !used.has(field)) {
      mapping[key] = field;
      used.add(field);
    }
  });
  return mapping;
}

function parseClassFromText(text) {
  if (!text) return null;
  const str = String(text).replace(/\s+/g, ' ').trim();
  const match =
    str.match(/(\d+)\s*\.\s*S[ıi]n[ıi]f\s*\/\s*([A-ZÇĞİÖŞÜa-zçğıöşü])/i) ||
    str.match(/(\d+)\s*\.\s*S[ıi]n[ıi]f\s*[\/\-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü])\b/i) ||
    str.match(/^(\d{1,2})\s*[\/.\-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü])\s*$/i) ||
    str.match(/^(\d{1,2})\s+([A-ZÇĞİÖŞÜa-zçğıöşü])(?:\s*(?:Şube|Sube))?$/i);
  if (!match) return null;
  return {
    class_level: String(Number(match[1])),
    section: match[2].toLocaleUpperCase('tr-TR'),
  };
}

/** Sınıf ve şubeyi ayrı veya birleşik (9/A, 9-A, 9.A) hücrelerden okur. */
function parseClassSection(classLevel, section) {
  let level = classLevel != null && classLevel !== '' ? String(classLevel).trim() : '';
  let sec = section != null && section !== '' ? String(section).trim() : '';

  if (level) {
    const fromText = parseClassFromText(level);
    if (fromText) {
      level = fromText.class_level;
      if (!sec) sec = fromText.section;
    } else {
      const onlyLevel = level.match(/^(\d{1,2})(?:\.\s*[Ss][ıi]n[ıi]f)?$/);
      if (onlyLevel) level = String(Number(onlyLevel[1]));
    }
  }

  if (sec) {
    const fromSec = parseClassFromText(sec);
    if (fromSec) {
      if (!level) level = fromSec.class_level;
      sec = fromSec.section;
    } else {
      const letter = sec.match(/([A-Za-zÇĞİÖŞÜçğıöşü])/);
      sec = letter ? letter[1].toLocaleUpperCase('tr-TR') : sec.toLocaleUpperCase('tr-TR');
    }
  }

  if (!level || !sec) return null;
  return { class_level: String(level), section: sec };
}

/** Bir satırın herhangi bir hücresinde "N. Sınıf / Şube" biçimli bir başlık arar. */
function detectRowClassInfo(row) {
  for (const cell of row || []) {
    const text = cellToDisplay(cell);
    const parsed = parseClassFromText(text);
    if (parsed) return { ...parsed, source_text: text };
  }
  return null;
}

function detectClassInfo(matrix, headerRowIndex) {
  const scanUntil = Math.min(headerRowIndex, 15);
  for (let i = 0; i < scanUntil; i += 1) {
    const found = detectRowClassInfo(matrix[i] || []);
    if (found) return found;
  }
  return null;
}

/**
 * MEB e-okul "Sınıf Listesi" dökümlerinde tek sayfada birden çok sınıf/şube art arda
 * basılır: her blok "N. Sınıf / X Şubesi ... Sınıf Listesi" başlığıyla açılır, ardından
 * "Sınıf Öğretmeni/Müdür Yrd" satırları, tablo başlığının tekrarı, öğrenci satırları ve
 * "... Öğrenci Sayısı" özet satırıyla kapanır — sonra yeni blok başlar. Bu yardımcılar,
 * öğrenci sütun eşlemesinde ayrı bir Sınıf/Şube sütunu olmayan böyle dosyalarda her
 * öğrenciyi ait olduğu bloğun sınıfına atayabilmek için "veri olmayan" satırları ayıklar.
 */
function isMetaOrSummaryRow(row) {
  const text = (row || [])
    .map((c) => cellToDisplay(c))
    .filter(Boolean)
    .join(' ');
  if (!text) return false;
  return /^(Sınıf Öğretmeni|Sınıf Müdür|Sınıf Başkan)/i.test(text.trim()) || /Öğrenci Sayısı/i.test(text);
}

function isRepeatedHeaderRow(row, headerCells) {
  if (!headerCells.length || !row) return false;
  let matches = 0;
  headerCells.forEach(({ index, label }) => {
    const cellLabel = cellToDisplay(row[index]);
    if (cellLabel && normalizeHeader(cellLabel) === normalizeHeader(label)) matches += 1;
  });
  return matches / headerCells.length >= 0.6;
}

/** Birleşik hücrelerde değer başlığın sağındaki boş sütunda olabilir. */
function readMappedCell(row, colIndex, nextHeaderIndex) {
  const limit =
    nextHeaderIndex != null && nextHeaderIndex > colIndex
      ? nextHeaderIndex
      : colIndex + 4;
  for (let i = colIndex; i < limit; i += 1) {
    const v = cellToDisplay(row[i]);
    if (v != null) return v;
  }
  return null;
}

function buildSampleRows(matrix, headerRowIndex, headers, limit = 5) {
  const samples = [];
  for (let r = headerRowIndex + 1; r < matrix.length && samples.length < limit; r += 1) {
    const row = matrix[r] || [];
    const values = {};
    let any = false;
    headers.forEach(({ index, label }, hi) => {
      const next = headers[hi + 1] ? headers[hi + 1].index : null;
      const v = readMappedCell(row, index, next);
      values[label] = v;
      if (v) any = true;
    });
    if (!any) continue;
    samples.push({ row: r + 1, values });
  }
  return samples;
}

function previewWorkbook(buffer, options = {}) {
  const headerMap = options.headerMap || IMPORT_HEADER_MAP;
  const importableFields = options.importableFields || IMPORTABLE_FIELDS;
  const { sheetNames, sheetName, matrix } = readSheetMatrix(buffer);
  const forcedHeader =
    options.headerRow != null && Number(options.headerRow) > 0
      ? Math.max(0, Number(options.headerRow) - 1)
      : null;
  const headerRowIndex =
    forcedHeader != null
      ? forcedHeader
      : detectHeaderRow(matrix, 40, headerMap, options.hintRegex || null);
  const headers = extractHeaders(matrix[headerRowIndex] || []);
  const suggested_mapping = suggestMapping(headers, headerMap);
  const detected_class = detectClassInfo(matrix, headerRowIndex);
  const sample_rows = buildSampleRows(matrix, headerRowIndex, headers);

  return {
    sheet_names: sheetNames,
    sheet_name: sheetName,
    header_row: headerRowIndex + 1,
    headers,
    suggested_mapping,
    detected_class,
    sample_rows,
    importable_fields: importableFields,
    total_rows: matrix.length,
  };
}

/**
 * @param {boolean} [opts.detectRepeatingClassBlocks] Sadece öğrenci içe aktarımında
 *   kullanılır (bkz. isMetaOrSummaryRow yorumu). Diğer içe aktarımları (ders programı vb.)
 *   bu davranışı istemediği için varsayılan kapalıdır.
 */
function getMappedRows(buffer, { headerRow, columnMapping, detectRepeatingClassBlocks = false }) {
  const { matrix } = readSheetMatrix(buffer);
  const headerRowIndex = Math.max(0, Number(headerRow || 1) - 1);
  const mappingEntries = Object.entries(columnMapping || {})
    .map(([col, field]) => [Number(col), field])
    .filter(([col, field]) => Number.isInteger(col) && col >= 0 && typeof field === 'string' && field)
    .sort((a, b) => a[0] - b[0]);

  const headerCells = extractHeaders(matrix[headerRowIndex] || []);
  const headerIndexes = headerCells.map((h) => h.index).sort((a, b) => a - b);

  let currentBlockClass = detectRepeatingClassBlocks ? detectClassInfo(matrix, headerRowIndex) : null;

  const rows = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const raw = {};
    mappingEntries.forEach(([col, field]) => {
      const nextHeader = headerIndexes.find((idx) => idx > col);
      raw[field] = readMappedCell(row, col, nextHeader != null ? nextHeader : null);
    });

    if (detectRepeatingClassBlocks) {
      // Bu kontroller, satırın eşlenen sütunlarında (readMappedCell'in ileri tarama
      // davranışı yüzünden) tesadüfen sayı/metin olsa bile önce çalışmalı — aksi halde
      // özet/başlık tekrarı satırları sahte "öğrenci" kaydı gibi görünebilir.
      if (isMetaOrSummaryRow(row) || isRepeatedHeaderRow(row, headerCells)) {
        continue;
      }
      const blockClass = detectRowClassInfo(row);
      if (blockClass) {
        currentBlockClass = blockClass;
        continue;
      }
      if (currentBlockClass) {
        if (raw.class_level == null || raw.class_level === '') raw.class_level = currentBlockClass.class_level;
        if (raw.section == null || raw.section === '') raw.section = currentBlockClass.section;
      }
    }

    const hasAny = Object.values(raw).some((v) => v != null && v !== '');
    if (!hasAny) continue;
    rows.push({ rowNumber: r + 1, raw });
  }
  return rows;
}

module.exports = {
  IMPORTABLE_FIELDS,
  IMPORT_HEADER_MAP,
  normalizeHeader,
  isExcelFileName,
  previewWorkbook,
  getMappedRows,
  parseClassFromText,
  parseClassSection,
  cellToDisplay,
  readSheetMatrix,
  fillMissingMappedFields,
};
