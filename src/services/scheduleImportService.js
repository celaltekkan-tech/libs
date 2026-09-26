'use strict';

const {
  previewWorkbook,
  getMappedRows,
  isExcelFileName,
  normalizeHeader,
} = require('./excelImportService');

const SCHEDULE_IMPORTABLE_FIELDS = [
  { key: 'class_level', label: 'Sınıf', required: false },
  { key: 'section', label: 'Şube', required: false },
  { key: 'classroom_label', label: 'Sınıf/Şube (birleşik)', required: false },
  { key: 'subject_name', label: 'Ders', required: true },
  { key: 'subject_code', label: 'Ders Kodu', required: false },
  { key: 'teacher_name', label: 'Öğretmen Ad Soyad', required: false },
  { key: 'personnel_no', label: 'Sicil No', required: false },
  { key: 'day_of_week', label: 'Gün', required: true },
  { key: 'period_no', label: 'Ders Saati', required: true },
  { key: 'academic_year', label: 'Eğitim Öğretim Yılı', required: false },
];

const SCHEDULE_HEADER_MAP = {
  sınıf: 'class_level',
  sinif: 'class_level',
  'sınıf seviyesi': 'class_level',
  'sinif seviyesi': 'class_level',
  sınıfı: 'class_level',
  sinifi: 'class_level',
  şube: 'section',
  sube: 'section',
  şubesi: 'section',
  subesi: 'section',
  'sınıf/şube': 'classroom_label',
  'sinif/sube': 'classroom_label',
  'sınıf şube': 'classroom_label',
  'sinif sube': 'classroom_label',
  sınıfşube: 'classroom_label',
  ders: 'subject_name',
  'ders adı': 'subject_name',
  'ders adi': 'subject_name',
  'ders adı/kodu': 'subject_name',
  branş: 'subject_name',
  brans: 'subject_name',
  'ders kodu': 'subject_code',
  kod: 'subject_code',
  öğretmen: 'teacher_name',
  ogretmen: 'teacher_name',
  'öğretmen adı': 'teacher_name',
  'ogretmen adi': 'teacher_name',
  'öğretmen ad soyad': 'teacher_name',
  'ad soyad': 'teacher_name',
  'sicil no': 'personnel_no',
  sicil: 'personnel_no',
  'personel no': 'personnel_no',
  gün: 'day_of_week',
  gun: 'day_of_week',
  'gün adı': 'day_of_week',
  'gun adi': 'day_of_week',
  'ders günü': 'day_of_week',
  saat: 'period_no',
  'ders saati': 'period_no',
  'ders saat': 'period_no',
  periyot: 'period_no',
  'saat no': 'period_no',
  'eğitim öğretim yılı': 'academic_year',
  'egitim ogretim yili': 'academic_year',
  'akademik yıl': 'academic_year',
  'akademik yil': 'academic_year',
  yıl: 'academic_year',
  yil: 'academic_year',
};

const DAY_NAME_TO_NUMBER = {
  pazartesi: 1,
  pzt: 1,
  salı: 2,
  sali: 2,
  sal: 2,
  çarşamba: 3,
  carsamba: 3,
  çar: 3,
  car: 3,
  perşembe: 4,
  persembe: 4,
  per: 4,
  cuma: 5,
  cum: 5,
  cumartesi: 6,
  cmt: 6,
  pazar: 7,
  paz: 7,
};

function previewScheduleWorkbook(buffer, options = {}) {
  return previewWorkbook(buffer, {
    ...options,
    headerMap: SCHEDULE_HEADER_MAP,
    importableFields: SCHEDULE_IMPORTABLE_FIELDS,
    hintRegex: /(ders|öğretmen|ogretmen|gün|gun|saat|sınıf|sinif|şube|sube|branş|brans)/i,
  });
}

function parseDayOfWeek(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && value >= 1 && value <= 7) return value;
  const raw = String(value).trim();
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 7) return asNum;
  const normalized = normalizeHeader(raw)
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
  if (DAY_NAME_TO_NUMBER[normalized]) return DAY_NAME_TO_NUMBER[normalized];
  const first = normalized.split(' ')[0];
  return DAY_NAME_TO_NUMBER[first] || null;
}

function parsePeriodNo(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

function parseClassroomLabel(value) {
  if (!value) return null;
  const str = String(value).trim().replace(/\s+/g, ' ');
  const match =
    str.match(/^(\d+)\s*[\/\-.]\s*([A-ZÇĞİÖŞÜa-zçğıöşü0-9]+)/) ||
    str.match(/(\d+)\s*\.\s*S[ıi]n[ıi]f\s*[\/\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü0-9]+)/i);
  if (!match) return null;
  return {
    class_level: match[1],
    section: match[2].toLocaleUpperCase('tr-TR'),
  };
}

function splitTeacherName(value) {
  if (!value) return null;
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first_name: parts[0] || '', last_name: '' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
}

module.exports = {
  SCHEDULE_IMPORTABLE_FIELDS,
  SCHEDULE_HEADER_MAP,
  previewScheduleWorkbook,
  getMappedRows,
  isExcelFileName,
  parseDayOfWeek,
  parsePeriodNo,
  parseClassroomLabel,
  splitTeacherName,
};
