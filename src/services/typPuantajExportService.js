'use strict';

const ExcelJS = require('exceljs');

const MONTH_NAMES = [
  '',
  'OCAK',
  'ŞUBAT',
  'MART',
  'NİSAN',
  'MAYIS',
  'HAZİRAN',
  'TEMMUZ',
  'AĞUSTOS',
  'EYLÜL',
  'EKİM',
  'KASIM',
  'ARALIK',
];

const PERSON_STARTS = [2, 8, 14, 20]; // B, H, N, T

/**
 * TYP EK-2 hücre kodları (İŞKUR açıklamalarına uyumlu).
 * Kodlar ileride güncellenebilir; raporlu için tek harf: R.
 */
const STATUS_CODES = {
  geldi: '',
  fazla_mesai: '',
  gelmedi: 'D', // mazeretsiz / gerekçesiz
  izinli: 'Ü', // ücretsiz izin
  raporlu: 'R', // sağlık raporu
  mazeretli: 'M', // mücbir mazeret (evlenme, doğum, vefat vb.)
  is_kazasi: 'İ', // iş kazası / meslek hastalığı
};

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };
/** Kapalı günler: orta gri (XXXX yazmaya gerek yok) */
const CLOSED_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF808080' },
};
const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year, month, day) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function formatDateTr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(value);
    return `${Number(m[3])}/${Number(m[2])}/${m[1].slice(2)}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

function setCell(ws, row, col, value, style = {}) {
  const cell = ws.getCell(row, col);
  if (value !== undefined) cell.value = value;
  if (style.font) cell.font = style.font;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
  if (style.fill) cell.fill = style.fill;
  if (style.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

function merge(ws, r1, c1, r2, c2) {
  ws.mergeCells(r1, c1, r2, c2);
}

/**
 * Kapatılacak günler:
 * - closedDays verilmişse (dışa aktarım seçimi) o liste esas alınır
 * - verilmemişse hafta sonları eklenir
 * - resmi tatiller her zaman kapatılır
 * - ayda olmayan günler (30/31) her zaman kapatılır
 */
function personStartIso(person) {
  const raw = person?.service_start_date || person?.first_duty_date;
  if (!raw) return null;
  const text = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function closedDaysForPerson(person, year, month, baseClosed) {
  const closed = new Set(baseClosed);
  const start = personStartIso(person);
  if (!start) return closed;
  const dim = daysInMonth(year, month);
  for (let day = 1; day <= dim; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (key < start) closed.add(day);
  }
  return closed;
}

function safeSheetName(subject, index, total) {
  const base = String(subject || 'TYP')
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim()
    .slice(0, 24) || 'TYP';
  const name = total === 1 ? base : `${base} ${index + 1}`;
  return name.slice(0, 31);
}

function buildClosedDaySet(year, month, holidays, closedDays) {
  const closed = new Set();
  const dim = daysInMonth(year, month);

  if (Array.isArray(closedDays)) {
    closedDays.forEach((d) => {
      const day = Number(d);
      if (day >= 1 && day <= dim) closed.add(day);
    });
  } else {
    for (let day = 1; day <= dim; day += 1) {
      if (isWeekend(year, month, day)) closed.add(day);
    }
  }

  (holidays || []).forEach((h) => {
    if (Number(h.month) !== Number(month)) return;
    if (h.year != null && Number(h.year) !== Number(year)) return;
    const day = Number(h.day);
    if (day >= 1 && day <= dim) closed.add(day);
  });

  for (let day = dim + 1; day <= 31; day += 1) closed.add(day);

  return closed;
}

function writeSheetHeader(ws, meta) {
  merge(ws, 1, 2, 1, 24);
  setCell(ws, 1, 2, 'EK-2:       Toplum Yararına Program Katılımcı Devam Çizelgesi', {
    font: { bold: true, size: 12, color: { argb: 'FF0070C0' }, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  merge(ws, 2, 2, 2, 24);
  setCell(ws, 2, 2, '(4 kişilik)', {
    font: { bold: true, size: 7, color: { argb: 'FF0070C0' }, name: 'Times New Roman' },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  merge(ws, 3, 2, 3, 24);
  setCell(
    ws,
    3,
    2,
    "Bu çizelge İŞKUR' a gönderilmeyecektir. Yüklenici, her katılımcıya devam ettikleri her gün için bu Çizelgeyi imzalatmak, muhafaza etmek ve ihtiyaç halinde yetkili kişi ve makamlara ibraz etmekle yükümlüdür.",
    {
      font: { size: 9, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    }
  );

  const labelFont = { bold: true, size: 9, name: 'Calibri' };
  const valueFont = { size: 9, name: 'Calibri' };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const left = { horizontal: 'left', vertical: 'middle', wrapText: true };

  // Yıl / Ay
  merge(ws, 5, 2, 5, 5);
  setCell(ws, 5, 2, 'Ait Olduğu Yıl', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 5, 6, 5, 12);
  setCell(ws, 5, 6, meta.year, { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 5, 13, 5, 16);
  setCell(ws, 5, 13, 'Ait Olduğu Ay', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 5, 17, 5, 21);
  setCell(ws, 5, 17, MONTH_NAMES[meta.month] || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 5, 22, 5, 24);
  setCell(ws, 5, 22, '', { border: BORDER_ALL });

  // TYP No / Konusu
  merge(ws, 6, 2, 6, 5);
  setCell(ws, 6, 2, 'TYP No', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 6, 6, 6, 12);
  setCell(ws, 6, 6, meta.typNo || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 6, 13, 6, 16);
  setCell(ws, 6, 13, 'TYP Konusu', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 6, 17, 6, 21);
  setCell(ws, 6, 17, meta.typSubject || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 6, 22, 6, 24);
  setCell(ws, 6, 22, '', { border: BORDER_ALL });

  // Başlama / Bitiş
  merge(ws, 7, 2, 7, 5);
  setCell(ws, 7, 2, 'TYP Başlama Tarihi', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 7, 6, 7, 12);
  setCell(ws, 7, 6, meta.typStartDate || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 7, 13, 7, 16);
  setCell(ws, 7, 13, 'TYP Bitiş Tarihi', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 7, 17, 7, 21);
  setCell(ws, 7, 17, meta.typEndDate || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 7, 22, 7, 24);
  setCell(ws, 7, 22, '', { border: BORDER_ALL });

  // Yüklenici / Müdür
  merge(ws, 8, 2, 8, 5);
  setCell(ws, 8, 2, 'Yüklenici Adı', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 8, 6, 8, 12);
  setCell(ws, 8, 6, meta.schoolName || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 8, 13, 8, 16);
  setCell(ws, 8, 13, 'Yüklenici Yetkilisi Adı Soyadı', {
    font: labelFont,
    alignment: center,
    border: BORDER_ALL,
    fill: HEADER_FILL,
  });
  merge(ws, 8, 17, 8, 21);
  setCell(ws, 8, 17, meta.principalName || '', { font: valueFont, alignment: center, border: BORDER_ALL });
  merge(ws, 8, 22, 8, 24);
  setCell(ws, 8, 22, '', { border: BORDER_ALL });

  // Apply borders to merged header cells (fill gaps)
  for (let r = 5; r <= 8; r += 1) {
    for (let c = 2; c <= 24; c += 1) {
      const cell = ws.getCell(r, c);
      cell.border = BORDER_ALL;
    }
  }

  ws.getRow(1).height = 16;
  ws.getRow(2).height = 21;
  ws.getRow(3).height = 32;
  ws.getRow(4).height = 8;
  ws.getRow(8).height = 24;
  ws.getRow(9).height = 8;
}

function writePersonBlock(ws, startCol, person, year, month, closedDays, attendanceByDay) {
  const labelFont = { bold: true, size: 9, name: 'Calibri' };
  const valueFont = { size: 9, name: 'Calibri' };
  const smallFont = { size: 9, name: 'Calibri' };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const left = { horizontal: 'left', vertical: 'middle', wrapText: true };

  const name = person ? `${person.first_name || ''} ${person.last_name || ''}`.trim().toUpperCase() : '';
  const tc = person?.national_id || '';

  merge(ws, 10, startCol, 10, startCol + 1);
  setCell(ws, 10, startCol, 'Ad Soyad:', { font: labelFont, alignment: left, border: BORDER_ALL });
  merge(ws, 10, startCol + 2, 10, startCol + 4);
  setCell(ws, 10, startCol + 2, name, { font: valueFont, alignment: center, border: BORDER_ALL });

  merge(ws, 11, startCol, 11, startCol + 1);
  setCell(ws, 11, startCol, 'TC Kimlik No:', { font: labelFont, alignment: left, border: BORDER_ALL });
  merge(ws, 11, startCol + 2, 11, startCol + 4);
  setCell(ws, 11, startCol + 2, tc, { font: valueFont, alignment: center, border: BORDER_ALL });

  setCell(ws, 12, startCol, 'Gün', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 12, startCol + 1, 12, startCol + 2);
  setCell(ws, 12, startCol + 1, 'Sabah', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });
  merge(ws, 12, startCol + 3, 12, startCol + 4);
  setCell(ws, 12, startCol + 3, 'Akşam', { font: labelFont, alignment: center, border: BORDER_ALL, fill: HEADER_FILL });

  for (let day = 1; day <= 31; day += 1) {
    const row = 12 + day;
    const closed = closedDays.has(day);
    const status = attendanceByDay?.[day];
    const code = closed ? '' : STATUS_CODES[status] || '';

    setCell(ws, row, startCol, day, {
      font: smallFont,
      alignment: center,
      border: BORDER_ALL,
      fill: closed ? CLOSED_FILL : undefined,
    });

    merge(ws, row, startCol + 1, row, startCol + 2);
    merge(ws, row, startCol + 3, row, startCol + 4);

    const morningStyle = {
      font: smallFont,
      alignment: center,
      border: BORDER_ALL,
      fill: closed ? CLOSED_FILL : undefined,
    };
    const eveningStyle = { ...morningStyle };

    setCell(ws, row, startCol + 1, code, morningStyle);
    setCell(ws, row, startCol + 3, code, eveningStyle);

    // Ensure merged partner cells have borders/fill
    for (const c of [startCol + 2, startCol + 4]) {
      const cell = ws.getCell(row, c);
      cell.border = BORDER_ALL;
      if (closed) cell.fill = CLOSED_FILL;
    }

    ws.getRow(row).height = 16.5;
  }
}

function writeFooter(ws) {
  merge(ws, 45, 2, 45, 24);
  setCell(ws, 45, 2, '  AÇIKLAMALAR', {
    font: { bold: true, size: 9, name: 'Calibri' },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  merge(ws, 46, 2, 46, 24);
  setCell(
    ws,
    46,
    2,
    'Katılımcı ücretsiz izin almışsa Ü, sağlık raporu nedeniyle izinliyse R, evlenme-doğum ve 1. derece yakınlarının vefatı gibi mücbir nedenlerle mazeretli gelmemişse M (Belgeleri eklenecek), mazeret iş kazası ve meslek hastalığı ise İ, bu haller dışında mazeretsiz ve gerekçesiz devamsızlık yaptıysa D yazılacaktır.',
    {
      font: { size: 8, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    }
  );
  ws.getRow(46).height = 36;
}

function setupColumns(ws) {
  ws.getColumn(1).width = 1.5;
  const widths = {
    2: 3.7,
    3: 4.7,
    4: 4.7,
    5: 4.7,
    6: 4.7,
    7: 2,
    8: 3.7,
    9: 4.7,
    10: 4.7,
    11: 4.7,
    12: 4.7,
    13: 2,
    14: 3.7,
    15: 4.7,
    16: 4.7,
    17: 4.7,
    18: 4.7,
    19: 2,
    20: 3.7,
    21: 4.7,
    22: 4.7,
    23: 4.7,
    24: 4.7,
  };
  Object.entries(widths).forEach(([col, width]) => {
    ws.getColumn(Number(col)).width = width;
  });
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9,
  };
}

/**
 * @param {{
 *   year: number,
 *   month: number,
 *   teachers: Array<object>,
 *   attendanceRows: Array<object>,
 *   holidays: Array<object>,
 *   closedDays?: number[],
 *   schoolName?: string,
 *   principalName?: string,
 *   typNo?: string,
 *   typSubject?: string,
 *   typStartDate?: string,
 *   typEndDate?: string,
 * }} opts
 */
async function buildTypPuantajWorkbook(opts) {
  const {
    year,
    month,
    teachers,
    attendanceRows,
    holidays,
    closedDays: extraClosedDays = [],
    schoolName = '',
    principalName = '',
    typNo = '',
    typSubject = '',
    typStartDate = '',
    typEndDate = '',
  } = opts;

  const closedDays = buildClosedDaySet(year, month, holidays, extraClosedDays);

  const attendanceMap = new Map();
  (attendanceRows || []).forEach((row) => {
    const day = Number(String(row.attendance_date).slice(8, 10));
    if (!attendanceMap.has(row.teacher_id)) attendanceMap.set(row.teacher_id, {});
    attendanceMap.get(row.teacher_id)[day] = row.status;
  });

  const wantedSubject = String(typSubject || '').trim().toLocaleLowerCase('tr-TR');
  const groups = new Map();
  for (const teacher of teachers) {
    const subject = String(teacher.typ_subject || teacher.title_branch || 'TYP').trim() || 'TYP';
    if (wantedSubject && subject.toLocaleLowerCase('tr-TR') !== wantedSubject) continue;
    const list = groups.get(subject) || [];
    list.push(teacher);
    groups.set(subject, list);
  }
  if (groups.size === 0) groups.set(typSubject || 'TYP', []);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Okul İdare';
  workbook.created = new Date();

  for (const [subject, people] of groups) {
    const chunks = [];
    for (let i = 0; i < Math.max(people.length, 1); i += 4) {
      chunks.push(people.slice(i, i + 4));
    }
    if (people.length === 0) chunks.splice(0, chunks.length, [null, null, null, null]);

    const inferredStart =
      typStartDate ||
      formatDateTr(people.find((t) => t.service_start_date)?.service_start_date) ||
      formatDateTr(people.find((t) => t.contract_start_date)?.contract_start_date) ||
      '';
    const inferredEnd =
      typEndDate || formatDateTr(people.find((t) => t.contract_end_date)?.contract_end_date) || '';

    chunks.forEach((chunk, idx) => {
      const ws = workbook.addWorksheet(safeSheetName(subject, idx, chunks.length), {
        views: [{ showGridLines: false }],
      });
      setupColumns(ws);
      writeSheetHeader(ws, {
        year,
        month,
        schoolName,
        principalName,
        typNo,
        typSubject: subject,
        typStartDate: inferredStart,
        typEndDate: inferredEnd,
      });

      PERSON_STARTS.forEach((startCol, personIdx) => {
        const person = chunk[personIdx] || null;
        const byDay = person ? attendanceMap.get(person.id) || {} : {};
        const personClosed = person
          ? closedDaysForPerson(person, year, month, closedDays)
          : closedDays;
        writePersonBlock(ws, startCol, person, year, month, personClosed, byDay);
      });

      writeFooter(ws);
    });
  }

  return workbook;
}

async function sendTypPuantajExport(res, opts) {
  const workbook = await buildTypPuantajWorkbook(opts);
  const filename = opts.filename || `typ-gunluk-puantaj-${opts.year}-${String(opts.month).padStart(2, '0')}`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
}

module.exports = {
  buildTypPuantajWorkbook,
  sendTypPuantajExport,
  buildClosedDaySet,
  STATUS_CODES,
  MONTH_NAMES,
};
