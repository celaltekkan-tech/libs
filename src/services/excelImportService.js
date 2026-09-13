'use strict';

const XLSX = require('xlsx');

const IMPORTABLE_FIELDS = [
  { key: 'student_number', label: 'Öğrenci No', required: true },
  { key: 'national_id', label: 'T.C. Kimlik No', required: false },
  { key: 'first_name', label: 'Ad', required: true },
  { key: 'last_name', label: 'Soyad', required: true },
  { key: 'class_level', label: 'Sınıf', required: false },
  { key: 'section', label: 'Şube', required: false },
  { key: 'gender', label: 'Cinsiyet', required: false },
  { key: 'birth_date', label: 'Doğum Tarihi', required: false },
  { key: 'registration_status', label: 'Kayıt Durumu', required: false },
  { key: 'parent_name', label: 'Veli Adı', required: false },
  { key: 'parent_phone', label: 'Veli Telefon', required: false },
  { key: 'is_inclusion', label: 'Kaynaştırma', required: false },
  { key: 'is_foreign', label: 'Yabancı Uyruklu', required: false },
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
  cinsiyeti: 'gender',
  cinsiyet: 'gender',
  'doğum tarihi': 'birth_date',
  'dogum tarihi': 'birth_date',
  'kayıt durumu': 'registration_status',
  'kayit durumu': 'registration_status',
  'veli adı': 'parent_name',
  'veli adi': 'parent_name',
  'veli telefon': 'parent_phone',
  'veli telefonu': 'parent_phone',
  kaynaştırma: 'is_inclusion',
  kaynastirma: 'is_inclusion',
  'yabancı uyruklu': 'is_foreign',
  'yabanci uyruklu': 'is_foreign',
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
    /(ad|soyad|öğrenci|ogrenci|kimlik|şube|sube|sınıf|sinif|cinsiyet|doğum|dogum|ders|öğretmen|ogretmen|gün|gun|saat)/i;
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

function suggestMapping(headers, headerMap = IMPORT_HEADER_MAP) {
  const mapping = {};
  const usedFields = new Set();
  headers.forEach(({ index, label }) => {
    const field = headerMap[normalizeHeader(label)];
    if (field && !usedFields.has(field)) {
      mapping[String(index)] = field;
      usedFields.add(field);
    }
  });
  return mapping;
}

function parseClassFromText(text) {
  if (!text) return null;
  const str = String(text).replace(/\s+/g, ' ');
  const match =
    str.match(/(\d+)\s*\.\s*S[ıi]n[ıi]f\s*\/\s*([A-ZÇĞİÖŞÜa-zçğıöşü])\s*Şube/i) ||
    str.match(/(\d+)\s*\.\s*S[ıi]n[ıi]f\s*[\/\-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü])\b/i);
  if (!match) return null;
  return {
    class_level: match[1],
    section: match[2].toLocaleUpperCase('tr-TR'),
  };
}

function detectClassInfo(matrix, headerRowIndex) {
  const scanUntil = Math.min(headerRowIndex, 15);
  for (let i = 0; i < scanUntil; i += 1) {
    const row = matrix[i] || [];
    for (const cell of row) {
      const text = cellToDisplay(cell);
      const parsed = parseClassFromText(text);
      if (parsed) return { ...parsed, source_text: text };
    }
  }
  return null;
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

function getMappedRows(buffer, { headerRow, columnMapping }) {
  const { matrix } = readSheetMatrix(buffer);
  const headerRowIndex = Math.max(0, Number(headerRow || 1) - 1);
  const mappingEntries = Object.entries(columnMapping || {})
    .map(([col, field]) => [Number(col), field])
    .filter(([col, field]) => Number.isInteger(col) && col >= 0 && typeof field === 'string' && field)
    .sort((a, b) => a[0] - b[0]);

  const headerCells = extractHeaders(matrix[headerRowIndex] || []);
  const headerIndexes = headerCells.map((h) => h.index).sort((a, b) => a - b);

  const rows = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const raw = {};
    mappingEntries.forEach(([col, field]) => {
      const nextHeader = headerIndexes.find((idx) => idx > col);
      raw[field] = readMappedCell(row, col, nextHeader != null ? nextHeader : null);
    });
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
};
