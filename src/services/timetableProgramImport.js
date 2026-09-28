'use strict';

// Hazır ders programını taslağa çevirir.
// Kabul edilen biçimler:
// - Bilsan öğretmen ders programı PDF'i (her sayfa bir öğretmen; gün satırı, üstünde şube, sütunda ders saati)
// - Gün adlarının sütun olduğu haftalık Excel çizelgesi
// - Satır satır Excel (sınıf, ders, öğretmen, gün, ders saati)

const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const {
  sequelize,
  TimetableAssignment,
  TimetableLesson,
  Classroom,
  Subject,
  SubjectClassHour,
  Teacher,
} = require('../models');
const { normalizeHeader } = require('./excelImportService');
const {
  previewScheduleWorkbook,
  getMappedRows,
  parseDayOfWeek,
  parsePeriodNo,
  parseClassroomLabel,
  isExcelFileName,
} = require('./scheduleImportService');

const DAY_WORD = {
  pazartesi: 1,
  salı: 2,
  sali: 2,
  çarşamba: 3,
  carsamba: 3,
  çarsamba: 3,
  perşembe: 4,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 7,
};

const FORMAT_LABEL = {
  'bilsan-pdf': 'Bilsan öğretmen ders programı (PDF)',
  'eokul-pdf': 'e-Okul şube ders programı (PDF)',
  'excel-grid': 'Haftalık çizelge (Excel)',
  'excel-table': 'Satır listesi (Excel)',
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function clean(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dayWord(text) {
  const key = normalizeHeader(text).replace(/\./g, '');
  return DAY_WORD[key] || null;
}

function findClass(text) {
  const raw = clean(text);
  if (!raw || raw.length > 16) return null;
  const direct = parseClassroomLabel(raw);
  if (direct) return { class_level: String(Number(direct.class_level)), section: direct.section };
  const match = raw.match(/^(\d{1,2})\s*[\/\-.]\s*([A-ZÇĞİÖŞÜa-zçğıöşü0-9]+)$/);
  if (!match) return null;
  return { class_level: String(Number(match[1])), section: match[2].toLocaleUpperCase('tr-TR') };
}

function classLabel(cls) {
  return `${cls.class_level}/${cls.section}`;
}

function center(item) {
  return item.x + (item.w || 0) / 2;
}

function columnGap(columns) {
  return columns.length > 1 ? Math.abs(columns[1].cx - columns[0].cx) || 60 : 60;
}

/** Metin kutusu birden çok ders saatinin üstüne taşıyorsa hepsini kapsar. */
function coveredColumns(item, columns) {
  const gap = columnGap(columns);
  const start = item.x;
  const end = item.x + Math.max(item.w || 0, 8);
  const hit = [];
  for (const col of columns) {
    const overlap = Math.min(end, col.cx + gap / 2) - Math.max(start, col.cx - gap / 2);
    if (overlap > gap * 0.45) hit.push(col);
  }
  if (hit.length) return hit;
  const nearest = nearestColumn(center(item), columns);
  return nearest ? [nearest] : [];
}

/** "METİN TAHLİLLERİ METİN TAHLİLLERİ" gibi yan yana kopyalanmış adı teke indirir. */
function unwrapSubject(text) {
  const value = clean(text);
  const parts = value.split(' ');
  for (let size = 1; size <= Math.floor(parts.length / 2); size += 1) {
    const phrase = parts.slice(0, size).join(' ');
    if (phrase.length < 3) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^(?:${escaped}\\s*){2,}$`).test(value)) return phrase;
  }
  return value;
}

/** Bitişik iki ders "MATEMATİKSEÇMELİ ..." diye tek metne yapışmış olabilir. */
function splitSubjects(text) {
  const unwrapped = unwrapSubject(text);
  const pieces = unwrapped
    .replace(/([^\s])(?=SEÇMELİ)/g, '$1 ')
    .split(/\s+(?=SEÇMELİ)/)
    .map((part) => unwrapSubject(part))
    .filter(Boolean);
  return pieces.length ? pieces : [unwrapped];
}

function nearestColumn(cx, columns) {
  let best = null;
  let dist = Infinity;
  for (const col of columns) {
    const d = Math.abs(col.cx - cx);
    if (d < dist) {
      dist = d;
      best = col;
    }
  }
  if (!best) return null;
  const gap =
    columns.length > 1 ? Math.abs(columns[1].cx - columns[0].cx) || 60 : 60;
  if (dist > gap * 0.7) return null;
  return best;
}

function clusterLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let prevY = null;
  for (const item of sorted) {
    if (prevY === null || prevY - item.y > 2.4) lines.push({ y: item.y, cells: [] });
    lines[lines.length - 1].cells.push(item);
    prevY = item.y;
  }
  return lines;
}

function teacherFromLines(lines) {
  for (const line of lines) {
    const joined = line.cells.map((c) => c.text).join(' ');
    const match = joined.match(/ad[ıi]\s*soyad[ıi]\s*:\s*(.+)/i);
    if (!match) continue;
    const name = clean(match[1]).replace(/\s*eğitici\s+kolu.*$/i, '');
    if (name) return name;
  }
  return '';
}

function periodColumns(lines) {
  for (const line of lines) {
    const cols = [];
    for (const cell of line.cells) {
      const match = clean(cell.text).match(/^\((\d{1,2})\)$/);
      if (!match) continue;
      const no = Number(match[1]);
      if (no < 1 || no > 14) continue;
      cols.push({ no, cx: center(cell) });
    }
    if (cols.length >= 4) return cols.sort((a, b) => a.cx - b.cx);
  }
  return null;
}

/** Bilsan öğretmen sayfası: gün satırındaki ders, bir üst satırdaki şube, (1)..(n) sütunları. */
function parseBilsanPage(items) {
  const lines = clusterLines(items);
  const periods = periodColumns(lines);
  if (!periods) return { teacher: '', slots: [] };
  const teacher = teacherFromLines(lines);
  const stop = items.find((it) => /yukarıdaki dersler/i.test(it.text));
  const minY = stop ? stop.y + 8 : 0;

  const dayLines = lines.filter((line) => {
    if (line.y < minY) return false;
    return line.cells.some((cell) => cell.x < 80 && dayWord(cell.text));
  });

  const chosen = new Map();
  for (const line of dayLines) {
    const dayCell = line.cells.find((cell) => cell.x < 80 && dayWord(cell.text));
    const day = dayWord(dayCell.text);
    const gap = columnGap(periods);
    const leftEdge = periods[0].cx - gap / 2;
    const above = items.filter((it) => it.y > line.y + 3.5 && it.y < line.y + 15 && center(it) >= leftEdge);
    const classes = new Map();
    for (const item of above) {
      const cls = findClass(item.text);
      if (!cls) continue;
      const col = nearestColumn(center(item), periods);
      if (col && !classes.has(col.no)) classes.set(col.no, cls);
    }
    for (const cell of line.cells) {
      if (cell === dayCell || center(cell) < leftEdge) continue;
      const clsOnLine = findClass(cell.text);
      const col = nearestColumn(center(cell), periods);
      if (!col) continue;
      if (clsOnLine) {
        if (!classes.has(col.no)) classes.set(col.no, clsOnLine);
        continue;
      }
      const subjects = splitSubjects(cell.text).filter((name) => name && !/^kapalı$/i.test(name));
      if (!subjects.length) continue;
      const cols = coveredColumns(cell, periods).filter((entry) => classes.has(entry.no));
      const targets = (cols.length ? cols : [col].filter((entry) => classes.has(entry.no))).sort(
        (a, b) => a.cx - b.cx,
      );
      const names =
        subjects.length === targets.length ? subjects : subjects.length === 1 ? targets.map(() => subjects[0]) : null;
      if (!names) {
        const only = targets.find((entry) => entry.no === col.no) || targets[0];
        if (!only) continue;
        targets.splice(0, targets.length, only);
      }
      const paired = names || [subjects[0]];
      paired.forEach((subject, index) => {
        const target = targets[index];
        if (!target) return;
        const cls = classes.get(target.no);
        const key = `${day}:${target.no}`;
        const dist = Math.abs(center(cell) - target.cx);
        const prev = chosen.get(key);
        if (prev && prev.dist <= dist) return;
        chosen.set(key, {
          dist,
          slot: {
            teacher_name: teacher,
            class_level: cls.class_level,
            section: cls.section,
            classroom_label: classLabel(cls),
            subject_name: subject,
            day_of_week: day,
            period_no: target.no,
          },
        });
      });
    }
  }
  return { teacher, slots: [...chosen.values()].map((entry) => entry.slot) };
}

async function pdfItems(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
    isEvalSupported: false,
  }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = [];
    for (const item of content.items) {
      const text = clean(item.str);
      if (!text) continue;
      items.push({
        x: item.transform[4],
        y: item.transform[5],
        w: item.width || 0,
        text,
      });
    }
    pages.push(items);
  }
  return pages;
}

function clusterGlyphs(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    const line = lines.find((row) => Math.abs(row.y - item.y) <= 2.2);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const tokens = [];
    for (const item of line.items) {
      const prev = tokens[tokens.length - 1];
      const gap = prev ? item.x - (prev.x + prev.w) : 99;
      if (prev && gap < 2.2) {
        prev.text = clean(`${prev.text}${gap > 1 ? ' ' : ''}${item.text}`);
        prev.w = item.x + item.w - prev.x;
      } else {
        tokens.push({ x: item.x, w: item.w || 0, text: item.text });
      }
    }
    line.tokens = tokens;
  }
  return lines;
}

function looksLikeEokul(pages) {
  const text = pages
    .slice(0, 2)
    .map((items) => items.map((item) => item.text).join(' '))
    .join(' ');
  return /ubesi/i.test(text) && /PAZARTES/i.test(text) && /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/.test(text);
}

const SUBJECT_HINT =
  /ders|kültür|kultur|hayat|bilgi|eğitim|egitim|spor|sanat|matemat|fizik|kimya|biyoloji|tarih|coğraf|cograf|edebiyat|rehber|demokra|adab|peygamber|seçmel|secmel|yabancı|yabanci|beden|görsel|gorsel|müzik|muzik|sağlık|saglik|trafik|felsefe|psikoloj|insan|inkılap|inkilap|mantık|mantik|sosyol|bilim/;

function looksLikeTeacher(text) {
  let raw = clean(text);
  if (normalizeHeader(raw).endsWith('seçmeli')) {
    raw = raw.replace(/\s*[-–—]\s*\S+\s*$/, '').trim();
  }
  const key = normalizeHeader(raw);
  if (!raw || SUBJECT_HINT.test(key)) return false;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /\p{L}/u.test(word));
}

function splitNameAndRest(text) {
  const match = clean(text).match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!match || !looksLikeTeacher(match[1])) return null;
  return { name: clean(match[1]), rest: clean(match[2]) };
}

function detachGluedElective(text) {
  const folded = normalizeHeader(text);
  if (!folded.startsWith('seçmeli') || folded.startsWith('seçmeli ')) return text;
  const extra = text.slice('seçmeli'.length).trim();
  return extra ? `Seçmeli ${extra}` : text;
}

function interpretEokulCell(lines) {
  const texts = lines.map(clean).filter(Boolean);
  if (!texts.length) return null;
  let teacher = '';
  const subjectBits = [];
  const elective = texts.some((text) => normalizeHeader(text).includes('seçmeli'));
  for (const text of texts) {
    const split = !teacher ? splitNameAndRest(text) : null;
    if (split) {
      teacher = split.name;
      if (split.rest && normalizeHeader(split.rest) !== 'seçmeli') subjectBits.push(detachGluedElective(split.rest));
      continue;
    }
    if (!teacher && looksLikeTeacher(text)) {
      teacher = clean(text);
      continue;
    }
    if (normalizeHeader(text) === 'seçmeli ders') continue;
    subjectBits.push(detachGluedElective(text));
  }
  let subject = clean(subjectBits.join(' '));
  if (!subject) return null;
  if (elective && !normalizeHeader(subject).startsWith('seçmeli')) subject = `Seçmeli ${subject}`;
  return { subject, teacher };
}

function classFromEokul(lines) {
  const joined = lines
    .slice(0, 10)
    .map((line) => line.tokens.map((token) => token.text).join(' '))
    .join(' ');
  const match = joined.match(/(\d{1,2})\s*\.?\s*s[ıi]n[ıi]f\s*\/\s*([A-ZÇĞİÖŞÜa-zçğıöşü0-9]+)/i);
  if (!match) return null;
  return { class_level: String(Number(match[1])), section: match[2].toLocaleUpperCase('tr-TR') };
}

function dayColumns(lines) {
  for (const line of lines) {
    const cols = [];
    for (const token of line.tokens) {
      const day = dayWord(token.text);
      if (!day) continue;
      cols.push({ day, cx: token.x + token.w / 2 });
    }
    if (cols.length >= 3) return cols.sort((a, b) => a.cx - b.cx);
  }
  return null;
}

function periodNumber(line) {
  const num = line.tokens.find((token) => token.x < 80 && /^\d{1,2}$/.test(token.text));
  const time = line.tokens.some((token) => /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/.test(token.text));
  if (!num || !time) return null;
  const value = Number(num.text);
  return value >= 1 && value <= 14 ? value : null;
}

function columnFor(token, days) {
  const cx = token.x + Math.max(token.w, 0) / 2;
  let best = null;
  let dist = Infinity;
  for (const day of days) {
    const gap = Math.abs(day.cx - cx);
    if (gap < dist) {
      dist = gap;
      best = day;
    }
  }
  if (!best) return null;
  const span = days.length > 1 ? (days[days.length - 1].cx - days[0].cx) / (days.length - 1) : 140;
  if (dist > span * 0.55) return null;
  return best;
}

/** e-Okul şube çizelgesi: yatay sayfa, günler sütun, solda ders saati ve saat aralığı. */
function parseEokulPage(items) {
  const lines = clusterGlyphs(items);
  const days = dayColumns(lines);
  const classroom = classFromEokul(lines);
  if (!days || !classroom) return { slots: [] };
  const markers = lines
    .map((line) => ({ line, no: periodNumber(line) }))
    .filter((row) => row.no);
  const slots = [];
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const nextY = markers[i + 1] ? markers[i + 1].line.y : marker.line.y - 36;
    const content = lines.filter((line) => line !== marker.line && line.y < marker.line.y + 10 && line.y > nextY + 10);
    const byDay = new Map();
    for (const line of content) {
      for (const token of line.tokens) {
        if (token.x < 90 && /^\d/.test(token.text)) continue;
        const col = columnFor(token, days);
        if (!col) continue;
        const list = byDay.get(col.day) || [];
        list.push({ y: line.y, text: token.text });
        byDay.set(col.day, list);
      }
    }
    for (const [day, parts] of byDay) {
      parts.sort((a, b) => b.y - a.y);
      const cell = interpretEokulCell(parts.map((part) => part.text));
      if (!cell) continue;
      slots.push({
        teacher_name: cell.teacher,
        class_level: classroom.class_level,
        section: classroom.section,
        classroom_label: classLabel(classroom),
        subject_name: cell.subject,
        day_of_week: day,
        period_no: marker.no,
      });
    }
  }
  return { classroom, slots };
}

function parseEokulPages(pages) {
  const slots = [];
  let recognized = 0;
  for (const items of pages) {
    const page = parseEokulPage(items);
    if (!page.classroom && !page.slots.length) continue;
    if (page.classroom) recognized += 1;
    slots.push(...page.slots);
  }
  if (!recognized) throw httpError(400, 'Bu PDF, e-Okul şube ders programı olarak okunamadı');
  if (!slots.length) throw httpError(400, 'PDF içinde yerleşmiş ders bulunamadı');
  return { format: 'eokul-pdf', slots };
}

async function parseBilsanPdf(buffer) {
  return parseBilsanFromPages(await pdfItems(buffer));
}

function parseBilsanFromPages(pages) {
  const slots = [];
  let recognized = 0;
  const teachers = new Set();
  for (const items of pages) {
    const page = parseBilsanPage(items);
    if (!page.teacher && !page.slots.length) continue;
    const hasGrid = items.some((it) => /^\(\d{1,2}\)$/.test(it.text));
    if (!hasGrid) continue;
    recognized += 1;
    if (page.teacher) teachers.add(normalizeHeader(page.teacher));
    slots.push(...page.slots);
  }
  if (!recognized) {
    throw httpError(400, 'Bu PDF, Bilsan öğretmen ders programı olarak okunamadı');
  }
  if (!slots.length) throw httpError(400, 'PDF içinde yerleşmiş ders bulunamadı');
  return { format: 'bilsan-pdf', slots, teachers: teachers.size };
}

function sheetMatrices(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  return workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false });
    return {
      name,
      rows: matrix.map((row) => (row || []).map((cell) => clean(cell))),
    };
  });
}

function parseExcelGrid(buffer) {
  const sheets = sheetMatrices(buffer);
  const slots = [];
  let detected = false;
  for (const sheet of sheets) {
    const headerIndex = sheet.rows.findIndex((row) => {
      const days = row.filter((cell) => dayWord(cell));
      return days.length >= 3;
    });
    if (headerIndex < 0) continue;
    detected = true;
    const header = sheet.rows[headerIndex];
    const dayCols = [];
    header.forEach((cell, index) => {
      const day = dayWord(cell);
      if (day) dayCols.push({ day, index });
    });
    const sheetClass = findClass(sheet.name.replace(/-/g, '/'));
    for (let r = headerIndex + 1; r < sheet.rows.length; r += 1) {
      const row = sheet.rows[r];
      if (row.filter(Boolean).length === 0) continue;
      if (row.filter((cell) => dayWord(cell)).length >= 3) break;
      const period = parsePeriodNo(row[0]);
      if (!period) continue;
      for (const col of dayCols) {
        const text = row[col.index];
        if (!text || /^kapalı$/i.test(text) || /^öğle/i.test(text)) continue;
        const lines = text
          .split(/\n/)
          .map(clean)
          .filter((line) => line && !/^\d{1,2}:\d{2}/.test(line));
        let classroom = sheetClass;
        const classIndex = lines.findIndex((line) => findClass(line));
        if (classIndex >= 0) {
          classroom = findClass(lines[classIndex]);
          lines.splice(classIndex, 1);
        }
        if (!classroom || !lines.length) continue;
        slots.push({
          teacher_name: lines[1] || '',
          class_level: classroom.class_level,
          section: classroom.section,
          classroom_label: classLabel(classroom),
          subject_name: lines[0],
          day_of_week: col.day,
          period_no: period,
        });
      }
    }
  }
  return { detected, slots };
}

function parseExcelTable(buffer) {
  let preview;
  try {
    preview = previewScheduleWorkbook(buffer);
  } catch {
    return [];
  }
  const mapping = preview.suggested_mapping || {};
  const fields = Object.values(mapping);
  const hasSubject = fields.includes('subject_name') || fields.includes('subject_code');
  const hasDay = fields.includes('day_of_week') && fields.includes('period_no');
  const hasClass =
    fields.includes('classroom_label') || (fields.includes('class_level') && fields.includes('section'));
  if (!hasSubject || !hasDay || !hasClass) return [];
  const rows = getMappedRows(buffer, {
    headerRow: preview.header_row,
    columnMapping: mapping,
  });
  const slots = [];
  for (const { raw } of rows) {
    let classroom = null;
    if (raw.classroom_label) classroom = findClass(raw.classroom_label);
    if (!classroom && raw.class_level && raw.section) {
      classroom = findClass(`${raw.class_level}/${raw.section}`);
    }
    const day = parseDayOfWeek(raw.day_of_week);
    const period = parsePeriodNo(raw.period_no);
    const subject = clean(raw.subject_name || raw.subject_code || '');
    if (!classroom || !day || !period || !subject) continue;
    slots.push({
      teacher_name: clean(raw.teacher_name || ''),
      class_level: classroom.class_level,
      section: classroom.section,
      classroom_label: classLabel(classroom),
      subject_name: subject,
      day_of_week: day,
      period_no: period,
    });
  }
  return slots;
}

async function parseExcel(buffer) {
  let richSlots = [];
  let richDetected = false;
  try {
    const rich = await parseExcelGridRich(buffer);
    richDetected = rich.detected;
    richSlots = rich.slots;
  } catch {
    richDetected = false;
  }
  const plain = parseExcelGrid(buffer);
  const gridSlots = richSlots.length >= plain.slots.length ? richSlots : plain.slots;
  const gridDetected = richDetected || plain.detected;
  if (gridDetected && gridSlots.length) return { format: 'excel-grid', slots: gridSlots };
  const tableSlots = parseExcelTable(buffer);
  if (tableSlots.length) return { format: 'excel-table', slots: tableSlots };
  if (gridDetected) throw httpError(400, 'Çizelgede okunabilir ders bulunamadı');
  throw httpError(
    400,
    'Excel okunamadı. Gün sütunlu bir çizelge ya da sınıf, ders, öğretmen, gün ve ders saati sütunları olan bir liste kullanın',
  );
}

function richText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return clean(value);
  if (value instanceof Date) return '';
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  if (value.text) return clean(value.text);
  if (value.result != null) return richText(value.result);
  return '';
}

/** Kendi Excel çıktımızdaki kalın ders adı + alt satır öğretmen metnini korur. */
async function parseExcelGridRich(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const slots = [];
  let detected = false;
  for (const sheet of workbook.worksheets) {
    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col] = richText(cell.value);
      });
      rows[row.number] = cells;
    });
    let headerNo = 0;
    let dayCols = [];
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const cols = [];
      row.forEach((text, index) => {
        const day = dayWord(text);
        if (day) cols.push({ day, index });
      });
      if (cols.length >= 3) {
        headerNo = r;
        dayCols = cols;
        break;
      }
    }
    if (!headerNo) continue;
    detected = true;
    const sheetClass = findClass(String(sheet.name).replace(/-/g, '/'));
    for (let r = headerNo + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const values = row.filter(Boolean);
      if (!values.length) continue;
      if (values.filter((cell) => dayWord(cell)).length >= 3) break;
      const period = parsePeriodNo(row[1]);
      if (!period) continue;
      for (const col of dayCols) {
        const text = row[col.index] || '';
        if (!text || /^kapalı$/i.test(clean(text)) || /^öğle/i.test(clean(text))) continue;
        const lines = text
          .split(/\n/)
          .map(clean)
          .filter((line) => line && !/^\d{1,2}:\d{2}/.test(line) && !/^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}$/.test(line));
        let classroom = sheetClass;
        const classIndex = lines.findIndex((line) => findClass(line));
        if (classIndex >= 0) {
          classroom = findClass(lines[classIndex]);
          lines.splice(classIndex, 1);
        }
        if (!classroom || !lines.length) continue;
        slots.push({
          teacher_name: lines[1] || '',
          class_level: classroom.class_level,
          section: classroom.section,
          classroom_label: classLabel(classroom),
          subject_name: lines[0],
          day_of_week: col.day,
          period_no: period,
        });
      }
    }
  }
  return { detected, slots };
}

async function parsePdf(buffer) {
  const pages = await pdfItems(buffer);
  if (looksLikeEokul(pages)) return parseEokulPages(pages);
  return parseBilsanFromPages(pages);
}

async function parseProgramFile(buffer, filename) {
  const name = String(filename || '').toLowerCase();
  const isPdf = name.endsWith('.pdf') || buffer.slice(0, 4).toString() === '%PDF';
  if (isPdf) return parsePdf(buffer);
  if (!isExcelFileName(name) && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    throw httpError(400, 'Yalnızca PDF, XLS veya XLSX dosyası kabul edilir');
  }
  return parseExcel(buffer);
}

function foldLessonName(name) {
  return normalizeHeader(name)
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[’'`.,;:!?()]/g, ' ')
    .replace(/[-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/peygamber efendimizin/g, 'peygamberimizin')
    .replace(/blim/g, 'bilim')
    .replace(/adab\s*u\s*mua/g, 'adabı mua')
    .trim();
}

/** Bilsan "SEÇMELİ ALMANCA" yazar; okuldaki karşılığı ikinci yabancı dildir. */
function isGermanName(raw) {
  const folded = foldLessonName(raw);
  if (!folded.includes('almanca')) return false;
  const words = folded.split(/\s+/).filter((word) => word && word !== 'seçmeli' && !/^\d+$/.test(word));
  return words.length > 0 && words.every((word) => word.replace(/almanca/g, '') === '');
}

function lessonKey(name) {
  return foldLessonName(name)
    .replace(/^seçmeli\s+/, '')
    .replace(/\s+\d+$/, '')
    .replace(/([a-zçğıöşü])\d+$/i, '$1')
    .trim();
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1], row[j]) + 1;
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

function pickSubject(list, wantElective) {
  const unique = [...new Map(list.map((row) => [row.id, row])).values()];
  if (!unique.length) return null;
  if (unique.length === 1) return unique[0];
  const namedElective = unique.filter((row) => /^seçmeli\s/i.test(foldLessonName(row.name)));
  const plain = unique.filter((row) => !namedElective.includes(row));
  if (wantElective && namedElective.length === 1) return namedElective[0];
  if (!wantElective && plain.length === 1) return plain[0];
  return null;
}

function subjectParts(name) {
  return String(name)
    .split('/')
    .map((part) => lessonKey(part))
    .filter(Boolean);
}

/** Dosyadaki ad, havuzdaki birleşik dersin bir parçasıysa o derse gider. Müzik tek başına kalmaz. */
function combinedPoolSubject(poolSubjects, key) {
  if (!poolSubjects?.length || !key) return null;
  const exact = [];
  const prefix = [];
  for (const row of poolSubjects) {
    if (!String(row.name).includes('/')) continue;
    const parts = subjectParts(row.name);
    if (parts.some((part) => part === key)) exact.push(row);
    else if (key.includes(' ') && parts.some((part) => part.startsWith(`${key} `))) prefix.push(row);
  }
  return pickSubject(exact.length ? exact : prefix, false);
}

function buildSubjectFinder(subjects, poolByLevel) {
  const byKey = new Map();
  for (const row of subjects) {
    const key = lessonKey(row.name);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  return (raw, classLevel) => {
    const folded = foldLessonName(raw);
    const wantElective = /^seçmeli\s/.test(folded);
    const key = lessonKey(raw);
    if (!key) return null;
    const level = String(classLevel ?? '').trim();
    const pooled = combinedPoolSubject(
      poolByLevel.get(level) || poolByLevel.get(String(Number(level))),
      key,
    );
    if (pooled) return pooled;
    if (byKey.has(key)) {
      const hit = pickSubject(byKey.get(key), wantElective);
      if (hit) return hit;
    }
    if (isGermanName(raw)) {
      const hit = pickSubject(
        subjects.filter((row) => lessonKey(row.name) === 'ikinci yabancı dil'),
        true,
      );
      if (hit) return hit;
    }
    const compact = key.replace(/\s/g, '');
    if (compact.length >= 8) {
      const compactHits = [];
      for (const [candidate, list] of byKey) {
        const other = candidate.replace(/\s/g, '');
        if (other === compact || (Math.abs(other.length - compact.length) <= 2 && editDistance(other, compact) <= 1)) {
          compactHits.push(...list);
        }
      }
      const compactHit = pickSubject(compactHits, wantElective);
      if (compactHit) return compactHit;
    }
    if (key === 'yabancı dil') {
      const hit = pickSubject(
        subjects.filter((row) => lessonKey(row.name) === 'birinci yabancı dil'),
        wantElective,
      );
      if (hit) return hit;
    }
    let bestScore = 0;
    let bestList = [];
    for (const [candidate, list] of byKey) {
      if (candidate.length < 8 || key.length < 8) continue;
      const shared = Math.min(key.length, candidate.length);
      let score = 0;
      if (candidate.startsWith(key) && candidate.length - key.length <= 24) score = key.length;
      else if (key.startsWith(`${candidate} `)) score = candidate.length;
      else if (shared >= 18 && key.slice(0, shared - 1) === candidate.slice(0, shared - 1)) score = shared - 1;
      if (!score) continue;
      if (score > bestScore) {
        bestScore = score;
        bestList = [...list];
      } else if (score === bestScore) bestList.push(...list);
    }
    const prefixHit = pickSubject(bestList, wantElective);
    if (prefixHit) return prefixHit;
    let best = [];
    let bestDist = 4;
    const limit = key.length >= 16 ? 3 : 2;
    for (const [candidate, list] of byKey) {
      if (Math.abs(candidate.length - key.length) > limit) continue;
      const dist = editDistance(candidate, key);
      if (dist > limit || dist === 0) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = [...list];
      } else if (dist === bestDist) best.push(...list);
    }
    return pickSubject(best, wantElective);
  };
}

function blockPattern(slots) {
  const byDay = new Map();
  for (const slot of slots) {
    const list = byDay.get(slot.day_of_week) || [];
    list.push(slot.period_no);
    byDay.set(slot.day_of_week, list);
  }
  const parts = [];
  for (const periods of byDay.values()) {
    const sorted = [...new Set(periods)].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= sorted.length; i += 1) {
      if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) run += 1;
      else {
        parts.push(run);
        run = 1;
      }
    }
  }
  parts.sort((a, b) => b - a);
  return parts.join('+');
}

function idMap(source) {
  const out = new Map();
  if (!source || typeof source !== 'object') return out;
  for (const [key, value] of Object.entries(source)) {
    const id = Number(value);
    if (String(key).trim() && Number.isInteger(id) && id > 0) out.set(String(key), id);
  }
  return out;
}

async function matchSlots(project, slots, overrides = {}) {
  const [classrooms, subjects, teachers, poolHours] = await Promise.all([
    Classroom.findAll({ where: { tenant_id: project.tenant_id, school_id: project.school_id } }),
    Subject.findAll({
      where: { tenant_id: project.tenant_id },
      attributes: ['id', 'name', 'is_elective', 'elective_group'],
    }),
    Teacher.findAll({
      where: { tenant_id: project.tenant_id },
      attributes: ['id', 'first_name', 'last_name'],
    }),
    SubjectClassHour.findAll({
      where: { tenant_id: project.tenant_id },
      attributes: ['subject_id', 'class_level'],
    }),
  ]);

  const classroomByKey = new Map();
  for (const row of classrooms) {
    const level = String(row.class_level).trim();
    const section = String(row.section || '').trim().toLocaleUpperCase('tr-TR');
    const numeric = String(Number(level));
    classroomByKey.set(`${level}|${section}`, row);
    classroomByKey.set(`${numeric}|${section}`, row);
  }
  const subjectById = new Map(subjects.map((row) => [row.id, row]));
  const poolByLevel = new Map();
  for (const hour of poolHours) {
    const subject = subjectById.get(hour.subject_id);
    if (!subject) continue;
    const level = String(hour.class_level ?? '').trim();
    const numeric = String(Number(level));
    for (const key of new Set([level, numeric].filter((item) => item && item !== 'NaN'))) {
      const list = poolByLevel.get(key) || [];
      if (!list.some((row) => row.id === subject.id)) list.push(subject);
      poolByLevel.set(key, list);
    }
  }
  const findSubject = buildSubjectFinder(subjects, poolByLevel);
  const teacherById = new Map(teachers.map((row) => [row.id, row]));
  const classroomById = new Map(classrooms.map((row) => [row.id, row]));
  const subjectOverride = idMap(overrides.subjects);
  const teacherOverride = idMap(overrides.teachers);
  const classroomOverride = idMap(overrides.classrooms);
  const teacherByName = new Map();
  for (const row of teachers) {
    const full = normalizeHeader(`${row.first_name || ''} ${row.last_name || ''}`);
    const swapped = normalizeHeader(`${row.last_name || ''} ${row.first_name || ''}`);
    if (full) teacherByName.set(full, row);
    if (swapped) teacherByName.set(swapped, row);
  }

  const ready = [];
  const gapCounts = new Map();
  const noteGap = (kind, raw) => {
    const key = `${kind}\n${raw}`;
    gapCounts.set(key, (gapCounts.get(key) || 0) + 1);
  };
  const seen = new Set();

  for (const slot of slots) {
    let classroom = classroomByKey.get(`${slot.class_level}|${slot.section}`);
    if (!classroom) classroom = classroomById.get(classroomOverride.get(slot.classroom_label)) || null;
    if (!classroom) {
      noteGap('classroom', slot.classroom_label);
      continue;
    }
    let subject = findSubject(slot.subject_name, slot.class_level);
    if (!subject) subject = subjectById.get(subjectOverride.get(slot.subject_name)) || null;
    if (!subject) {
      noteGap('subject', slot.subject_name);
      continue;
    }
    let teacher = null;
    if (slot.teacher_name) {
      teacher = teacherByName.get(normalizeHeader(slot.teacher_name)) || null;
      if (!teacher) teacher = teacherById.get(teacherOverride.get(slot.teacher_name)) || null;
      if (!teacher) noteGap('teacher', slot.teacher_name);
    }
    const dedupe = `${classroom.id}:${slot.day_of_week}:${slot.period_no}:${subject.id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    ready.push({
      classroom_id: classroom.id,
      subject_id: subject.id,
      teacher_id: teacher ? teacher.id : null,
      teacher_name: slot.teacher_name || '',
      classroom_label: slot.classroom_label,
      subject_name: subject.name,
      elective_group: subject.is_elective ? subject.elective_group || null : null,
      day_of_week: slot.day_of_week,
      period_no: slot.period_no,
    });
  }

  const gapLabel = { classroom: 'Sınıf bulunamadı', subject: 'Ders bulunamadı', teacher: 'Öğretmen eşleşmedi' };
  const gaps = [...gapCounts.entries()]
    .map(([key, count]) => {
      const splitAt = key.indexOf('\n');
      const kind = key.slice(0, splitAt);
      const raw = key.slice(splitAt + 1);
      return { kind, raw, count, message: `${gapLabel[kind]}: ${raw}${count > 1 ? ` (${count})` : ''}` };
    })
    .slice(0, 40);

  return { ready, gaps, issues: gaps.map((gap) => ({ message: gap.message })) };
}

function summarize(parsed, matched) {
  const teachers = new Set(parsed.slots.map((s) => normalizeHeader(s.teacher_name)).filter(Boolean));
  const classes = new Set(matched.ready.map((s) => s.classroom_label));
  return {
    format: parsed.format,
    format_label: FORMAT_LABEL[parsed.format] || parsed.format,
    teacher_count: teachers.size,
    slot_count: parsed.slots.length,
    matched: matched.ready.length,
    classroom_count: classes.size,
    issues: matched.issues,
    gaps: matched.gaps,
    sample: matched.ready.slice(0, 40).map((row) => ({
      teacher: row.teacher_name,
      classroom: row.classroom_label,
      subject: row.subject_name,
      day: row.day_of_week,
      period: row.period_no,
    })),
  };
}

async function previewProgram(project, buffer, filename) {
  const parsed = await parseProgramFile(buffer, filename);
  const matched = await matchSlots(project, parsed.slots);
  return summarize(parsed, matched);
}

async function importProgram(project, buffer, filename, { replace, overrides }) {
  const parsed = await parseProgramFile(buffer, filename);
  const matched = await matchSlots(project, parsed.slots, overrides);
  if (!matched.ready.length) {
    throw httpError(400, 'Eşleşen ders bulunamadı. Sınıf ve ders adları sistemdekilerle aynı olmalı');
  }

  const groups = new Map();
  for (const slot of matched.ready) {
    const key = `${slot.classroom_id}:${slot.subject_id}:${slot.teacher_id || 0}`;
    const group = groups.get(key) || { ...slot, slots: [] };
    group.slots.push(slot);
    groups.set(key, group);
  }

  let createdAssignments = 0;
  let updatedAssignments = 0;
  let lessons = 0;

  await sequelize.transaction(async (transaction) => {
    const occupied = new Set();
    if (replace) {
      await TimetableLesson.destroy({ where: { project_id: project.id }, transaction });
    } else {
      const existing = await TimetableLesson.findAll({
        where: { project_id: project.id },
        include: [{ model: TimetableAssignment, as: 'Assignment', attributes: ['classroom_id'] }],
        transaction,
      });
      for (const lesson of existing) {
        if (lesson.Assignment) {
          occupied.add(`${lesson.Assignment.classroom_id}:${lesson.day_of_week}:${lesson.period_no}`);
        }
      }
    }

    const assignments = await TimetableAssignment.findAll({
      where: { project_id: project.id },
      transaction,
    });
    const used = new Set();
    const lessonRows = [];

    for (const group of groups.values()) {
      const slots = group.slots.filter(
        (slot) => !occupied.has(`${group.classroom_id}:${slot.day_of_week}:${slot.period_no}`),
      );
      if (!slots.length) continue;
      const same = assignments.filter(
        (row) => row.classroom_id === group.classroom_id && row.subject_id === group.subject_id && !used.has(row.id),
      );
      let row =
        same.find((item) => item.teacher_id && item.teacher_id === group.teacher_id) ||
        same.find((item) => !item.teacher_id) ||
        (same.length === 1 ? same[0] : null);
      const pattern = blockPattern(slots);
      if (!row) {
        row = await TimetableAssignment.create(
          {
            tenant_id: project.tenant_id,
            project_id: project.id,
            classroom_id: group.classroom_id,
            subject_id: group.subject_id,
            teacher_id: group.teacher_id,
            weekly_hours: slots.length,
            block_pattern: pattern,
            source: 'import',
            elective_group: group.elective_group,
            co_teacher_ids: [],
          },
          { transaction },
        );
        assignments.push(row);
        createdAssignments += 1;
      } else {
        await row.update(
          {
            teacher_id: group.teacher_id || row.teacher_id,
            weekly_hours: slots.length,
            block_pattern: pattern,
            elective_group: row.elective_group || group.elective_group,
          },
          { transaction },
        );
        updatedAssignments += 1;
      }
      used.add(row.id);
      for (const slot of slots) {
        lessonRows.push({
          tenant_id: project.tenant_id,
          project_id: project.id,
          assignment_id: row.id,
          day_of_week: slot.day_of_week,
          period_no: slot.period_no,
          is_locked: true,
        });
        occupied.add(`${group.classroom_id}:${slot.day_of_week}:${slot.period_no}`);
      }
    }

    if (lessonRows.length) {
      await TimetableLesson.bulkCreate(lessonRows, { transaction });
      lessons = lessonRows.length;
    }

    const days = new Set(project.days || []);
    let daysChanged = false;
    let maxPeriod = project.periods_per_day || 1;
    for (const slot of matched.ready) {
      if (!days.has(slot.day_of_week)) {
        days.add(slot.day_of_week);
        daysChanged = true;
      }
      if (slot.period_no > maxPeriod) maxPeriod = slot.period_no;
    }
    if (daysChanged || maxPeriod !== project.periods_per_day) {
      project.days = [...days].sort((a, b) => a - b);
      project.periods_per_day = maxPeriod;
      await project.save({ transaction });
    }
  });

  return {
    ...summarize(parsed, matched),
    created_assignments: createdAssignments,
    updated_assignments: updatedAssignments,
    lessons,
  };
}

module.exports = {
  parseProgramFile,
  previewProgram,
  importProgram,
};
