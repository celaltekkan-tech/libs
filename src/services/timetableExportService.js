'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const {
  TimetableLesson,
  TimetableAssignment,
  TimetableRoom,
  TimetableElectiveChoice,
  Classroom,
  District,
  Province,
  Subject,
  Teacher,
  Student,
  School,
} = require('../models');
const { classroomLabel, teacherName, assignmentTeacherIds } = require('./timetableBuildService');
const { resolvePrincipalName } = require('./schoolPrincipalService');
const { registerUnicodeFonts } = require('../utils/pdfFonts');

const VIEWS = ['classroom', 'teacher', 'teacher_detail', 'classroom_detail', 'student', 'room', 'carsaf'];
const DAY_NAMES = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};
const DAY_SHORT = {
  1: 'PZT',
  2: 'SALI',
  3: 'ÇAR.',
  4: 'PRŞ',
  5: 'CUMA',
  6: 'C.TESİ',
  7: 'PAZAR',
};
const STATUS_LABEL = { taslak: 'Taslak', yayinda: 'Yayında', arsiv: 'Arşiv' };
const FILE_BASE = {
  classroom: ['ders-programi-sube', 'ders-programi-subeler'],
  teacher: ['ders-programi-ogretmen', 'ders-programi-ogretmenler'],
  teacher_detail: ['ayrintili-program-ogretmen', 'ayrintili-program-ogretmenler'],
  classroom_detail: ['ayrintili-program-sube', 'ayrintili-program-subeler'],
  student: ['ders-programi-ogrenci', 'ders-programi-ogrenciler'],
  room: ['ders-programi-mekan', 'ders-programi-mekanlar'],
  carsaf: ['carsaf-program', 'carsaf-program'],
};
const DETAIL_KIND = { teacher_detail: 'teacher', classroom_detail: 'classroom' };
// Çıktılar siyah beyaz basılır; zemin rengi kullanılmaz, ayrım kalınlık ve çizgiyle yapılır.
const INK = 'FF000000';
const THIN = { style: 'thin', color: { argb: INK } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function trSort(a, b) {
  return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
}

function bellOf(settings) {
  const bell = settings?.bell || {};
  return {
    start_time: bell.start_time || '08:30',
    lesson_minutes: bell.lesson_minutes || 40,
    break_minutes: bell.break_minutes ?? 10,
    breaks: Array.isArray(bell.breaks) ? bell.breaks : [],
    day_breaks: Array.isArray(bell.day_breaks) ? bell.day_breaks : [],
  };
}

function gapMinutes(bell, day, afterPeriod, lunchAfter) {
  const extra = bell.day_breaks.find((item) => item.day === day && item.after_period === afterPeriod);
  if (extra) return extra.minutes;
  const listed = bell.breaks[afterPeriod - 1];
  const base = listed == null ? bell.break_minutes : listed;
  if (lunchAfter === afterPeriod) return Math.max(base, 30);
  return base;
}

function parseMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return 8 * 60 + 30;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(total) {
  const minutes = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function periodStart(bell, day, period, lunchAfter) {
  let cursor = parseMinutes(bell.start_time);
  for (let current = 1; current < period; current += 1) {
    cursor += bell.lesson_minutes;
    cursor += gapMinutes(bell, day, current, lunchAfter);
  }
  return cursor;
}

function periodRange(bell, day, period, lunchAfter) {
  const start = periodStart(bell, day, period, lunchAfter);
  return `${formatMinutes(start)}–${formatMinutes(start + bell.lesson_minutes)}`;
}

function sheetName(raw, used) {
  const cleaned = String(raw || 'Sayfa')
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Sayfa';
  let base = cleaned.slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLocaleLowerCase('tr-TR'))) {
    const suffix = ` ${n}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(name.toLocaleLowerCase('tr-TR'));
  return name;
}

function lessonRoomId(lesson) {
  return lesson.room_id || lesson.Assignment?.room_id || null;
}

function teacherLine(assignment, teachersById) {
  return assignmentTeacherIds(assignment)
    .map((id) => {
      if (id === assignment.teacher_id && assignment.Teacher) return teacherName(assignment.Teacher);
      return teacherName(teachersById.get(id));
    })
    .filter(Boolean)
    .join(', ');
}

function describeLesson(lesson, view, teachersById, roomsById) {
  const assignment = lesson.Assignment;
  const roomId = lessonRoomId(lesson);
  const room = roomId ? roomsById.get(roomId)?.name || assignment.Room?.name || '' : '';
  const subject = assignment.Subject?.name || 'Ders';
  const cls = classroomLabel(assignment.Classroom);
  const teachers = teacherLine(assignment, teachersById);
  let lines = [];
  if (view === 'teacher') lines = [cls, room];
  else if (view === 'room') lines = [cls, teachers];
  else lines = [teachers, room];
  return { title: subject, lines: lines.filter(Boolean), fillId: assignment.subject_id || 0 };
}

function choiceIndex(choiceRows) {
  const byAssignment = new Map();
  const classesWithChoices = new Set();
  const countByStudent = new Map();
  for (const row of choiceRows) {
    if (!byAssignment.has(row.assignment_id)) byAssignment.set(row.assignment_id, new Set());
    byAssignment.get(row.assignment_id).add(row.student_id);
    if (row.classroom_id) classesWithChoices.add(row.classroom_id);
    countByStudent.set(row.student_id, (countByStudent.get(row.student_id) || 0) + 1);
  }
  return { byAssignment, classesWithChoices, countByStudent };
}

function lessonsFor(view, entityId, lessons, choiceCtx) {
  if (view === 'classroom') return lessons.filter((l) => l.Assignment?.classroom_id === entityId);
  if (view === 'teacher') return lessons.filter((l) => assignmentTeacherIds(l.Assignment || {}).includes(entityId));
  if (view === 'room') return lessons.filter((l) => lessonRoomId(l) === entityId);
  const student = entityId;
  const classId = student.classroom_id;
  const classHasChoices = choiceCtx.classesWithChoices.has(classId);
  return lessons.filter((l) => {
    const assignment = l.Assignment;
    if (!assignment || assignment.classroom_id !== classId) return false;
    if (!assignment.elective_group) return true;
    if (!classHasChoices) return true;
    const chosen = choiceCtx.byAssignment.get(assignment.id);
    return Boolean(chosen && chosen.has(student.id));
  });
}

function entitiesOf(view, lessons, students, teachersById, roomsById, classLabels) {
  if (view === 'student') {
    return students
      .map((student) => {
        const cls = classLabels.get(student.classroom_id) || '';
        const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
        const number = student.student_number ? String(student.student_number) : '';
        const label = [cls, number, name].filter(Boolean).join(' ');
        return { id: student, key: student.id, label, sheet: label || `Ogrenci ${student.id}`, classroomId: student.classroom_id };
      })
      .sort((a, b) => trSort(a.label, b.label));
  }

  const map = new Map();
  for (const lesson of lessons) {
    const assignment = lesson.Assignment;
    if (!assignment) continue;
    if (view === 'classroom' && assignment.classroom_id) {
      map.set(assignment.classroom_id, classLabels.get(assignment.classroom_id) || `Şube ${assignment.classroom_id}`);
    }
    if (view === 'teacher') {
      for (const id of assignmentTeacherIds(assignment)) {
        const name =
          id === assignment.teacher_id && assignment.Teacher
            ? teacherName(assignment.Teacher)
            : teacherName(teachersById.get(id));
        map.set(id, name || `Öğretmen ${id}`);
      }
    }
    if (view === 'room') {
      const id = lessonRoomId(lesson);
      if (!id) continue;
      map.set(id, roomsById.get(id)?.name || assignment.Room?.name || `Mekan ${id}`);
    }
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, key: id, label, sheet: label, classroomId: view === 'classroom' ? id : null }))
    .sort((a, b) => trSort(a.label, b.label));
}

function lunchAfterFor(project, classroomId) {
  if (classroomId != null) {
    const custom = project.settings?.class_lunch?.[String(classroomId)];
    if (custom) return custom;
  }
  return project.lunch_after || null;
}

function richLesson(items, timeNote) {
  const rich = [];
  if (timeNote) {
    rich.push({ font: { name: 'Calibri', size: 8, color: { argb: INK } }, text: `${timeNote}\n` });
  }
  items.forEach((item, index) => {
    if (index > 0) rich.push({ font: { name: 'Calibri', size: 8, color: { argb: INK } }, text: '\n—\n' });
    rich.push({ font: { name: 'Calibri', bold: true, size: 10, color: { argb: INK } }, text: item.title });
    if (item.lines.length) {
      rich.push({ font: { name: 'Calibri', size: 9, color: { argb: INK } }, text: `\n${item.lines.join('\n')}` });
    }
  });
  return { richText: rich };
}

function lineCount(items) {
  return items.reduce((sum, item, index) => sum + (index ? 1 : 0) + 1 + item.lines.length, 0);
}

function addGridSheet(workbook, usedNames, spec) {
  const {
    sheet,
    title,
    subtitle,
    footnote,
    days,
    periods,
    bell,
    lunchAfter,
    slots,
  } = spec;
  const ws = workbook.addWorksheet(sheetName(sheet, usedNames), {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
      horizontalCentered: true,
    },
    views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }],
  });
  const cols = 1 + days.length;
  ws.mergeCells(1, 1, 1, cols);
  ws.mergeCells(2, 1, 2, cols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: INK } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 20;

  const header = ws.getRow(3);
  header.height = 22;
  const headers = ['Saat', ...days.map((day) => DAY_NAMES[day] || String(day))];
  headers.forEach((text, index) => {
    const cell = header.getCell(index + 1);
    cell.value = text;
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });

  const refDay = days[0] || 1;
  let rowNo = 4;
  for (const period of periods) {
    if (lunchAfter && period === lunchAfter + 1) {
      ws.mergeCells(rowNo, 1, rowNo, cols);
      const lunch = ws.getCell(rowNo, 1);
      lunch.value = 'Öğle arası';
      lunch.font = { name: 'Calibri', italic: true, size: 10, color: { argb: INK } };
      lunch.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(rowNo).height = 16;
      rowNo += 1;
    }

    const row = ws.getRow(rowNo);
    const baseRange = periodRange(bell, refDay, period, lunchAfter);
    const hour = row.getCell(1);
    hour.value = `${period}\n${baseRange}`;
    hour.font = { name: 'Calibri', bold: true, size: 10, color: { argb: INK } };
    hour.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    hour.border = BORDER;

    let maxLines = 2;
    days.forEach((day, index) => {
      const cell = row.getCell(index + 2);
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const key = `${day}:${period}`;
      const items = slots.get(key) || [];
      if (!items.length) return;
      const range = periodRange(bell, day, period, lunchAfter);
      const timeNote = range === baseRange ? '' : range;
      cell.value = richLesson(items, timeNote);
      maxLines = Math.max(maxLines, lineCount(items) + (timeNote ? 1 : 0));
    });
    row.height = Math.min(96, Math.max(36, maxLines * 15));
    rowNo += 1;
  }

  if (footnote) {
    ws.mergeCells(rowNo, 1, rowNo, cols);
    const note = ws.getCell(rowNo, 1);
    note.value = footnote;
    note.font = { name: 'Calibri', italic: true, size: 9, color: { argb: INK } };
    note.alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(rowNo).height = 32;
  }

  ws.getColumn(1).width = 16;
  for (let i = 2; i <= cols; i += 1) ws.getColumn(i).width = 24;
  ws.pageSetup.printTitlesRow = '1:3';
  ws.headerFooter.oddFooter = `&L${title}&RSayfa &P / &N`;
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.55, header: 0.2, footer: 0.25 };
}

/** Resmi yazı başlığı: T.C. / kaymakamlık ya da valilik / okul müdürlüğü. */
function organizationLines(school) {
  const upper = (value) => String(value || '').toLocaleUpperCase('tr-TR');
  const district = school?.District?.name ? `${upper(school.District.name)} KAYMAKAMLIĞI` : '';
  const province = school?.Province?.name ? `${upper(school.Province.name)} VALİLİĞİ` : '';
  const name = school?.name ? `${upper(school.name)} MÜDÜRLÜĞÜ` : '';
  return ['T.C.', district || province, name].filter(Boolean);
}

function dateText(value) {
  const d = value instanceof Date ? value : new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function labelCell(ws, row, from, to, text, bold = false) {
  if (to > from) ws.mergeCells(row, from, row, to);
  const cell = ws.getCell(row, from);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 10, bold, color: { argb: INK } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  return cell;
}

function surnameOf(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function shortSubject(subject) {
  const name = String(subject?.name || 'Ders').trim();
  const word = name.split(/\s+/)[0] || name;
  if (word.length <= 6) return word;
  return `${word.slice(0, 5)}.`;
}

/** Ders saatlerini güne göre sayar. Şube ayrıntısında satır öğretmen+derstir. */
function detailRows(lessons, roomsById, options = {}) {
  const kind = options.kind || 'teacher';
  const teachersById = options.teachersById || new Map();
  const map = new Map();
  for (const lesson of lessons) {
    const assignment = lesson.Assignment;
    const who = kind === 'classroom' ? teacherLine(assignment, teachersById) : classroomLabel(assignment.Classroom);
    const key = kind === 'classroom' ? `${who}|${assignment.subject_id}` : `${assignment.classroom_id}|${assignment.subject_id}`;
    let row = map.get(key);
    if (!row) {
      const roomId = lessonRoomId(lesson);
      row = {
        room: roomId ? roomsById.get(roomId)?.name || assignment.Room?.name || '' : '',
        classroom: who,
        code: assignment.Subject?.code || '',
        subject: assignment.Subject?.name || 'Ders',
        byDay: new Map(),
        total: 0,
      };
      map.set(key, row);
    }
    row.byDay.set(lesson.day_of_week, (row.byDay.get(lesson.day_of_week) || 0) + 1);
    row.total += 1;
  }
  return [...map.values()].sort((a, b) => trSort(a.classroom, b.classroom) || trSort(a.subject, b.subject));
}

function carsafCell(bucket, mode, teachersById) {
  return bucket
    .map((lesson) => {
      const subject = shortSubject(lesson.Assignment?.Subject);
      if (mode === 'classroom') {
        const who = surnameOf(teacherLine(lesson.Assignment, teachersById));
        return [subject, who].filter(Boolean).join(' ');
      }
      const cls = classroomLabel(lesson.Assignment?.Classroom);
      return [cls, subject].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(' / ');
}

/**
 * MEB'de "ayrıntılı program" denen öğretmen el programı: günler satır, ders saatleri
 * sütun; altında imza bloğu ve derslerin gün gün saat dökümü.
 */
function addTeacherDetailSheet(workbook, usedNames, spec) {
  const { sheet, orgLines, days, periods, bell, lunchAfter, lessons, roomsById, principalName, teachersById } = spec;
  const kind = spec.kind || 'teacher';
  const ownerLabel = spec.ownerLabel || spec.teacherLabel || '';
  const gridCols = 1 + periods.length;
  const summaryCols = 5 + days.length + 1;
  const cols = Math.max(gridCols, summaryCols);
  const ws = workbook.addWorksheet(sheetName(sheet, usedNames), {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
      horizontalCentered: true,
    },
  });

  let rowNo = 1;
  for (const line of orgLines) {
    ws.mergeCells(rowNo, 1, rowNo, cols);
    const cell = ws.getCell(rowNo, 1);
    cell.value = line;
    cell.font = { name: 'Calibri', bold: true, size: line === 'T.C.' ? 10 : 11, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    rowNo += 1;
  }
  rowNo += 1;

  const third = Math.max(2, Math.floor(cols / 3));
  labelCell(ws, rowNo, 1, third, 'Sayı :');
  labelCell(ws, rowNo, third + 1, third * 2, 'Sınıf Öğretmenliği :');
  labelCell(ws, rowNo, third * 2 + 1, cols, 'Nöbet Günü ve Yeri :');
  rowNo += 1;
  labelCell(ws, rowNo, 1, third, kind === 'classroom' ? `Sınıf : ${ownerLabel}` : `Adı Soyadı : ${ownerLabel}`, true);
  labelCell(ws, rowNo, third + 1, cols, 'Eğitici Kolu (Kulüp) :');
  rowNo += 2;

  const refDay = days[0] || 1;
  const headRow = ws.getRow(rowNo);
  headRow.height = 18;
  const corner = headRow.getCell(1);
  corner.value = 'Ders\\Gün';
  corner.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
  corner.alignment = { vertical: 'middle', horizontal: 'center' };
  corner.border = BORDER;
  periods.forEach((period, index) => {
    const cell = headRow.getCell(index + 2);
    cell.value = `(${period})`;
    cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });
  rowNo += 1;

  const clockRow = ws.getRow(rowNo);
  clockRow.height = 26;
  const clockHead = clockRow.getCell(1);
  clockHead.value = 'Saat';
  clockHead.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
  clockHead.alignment = { vertical: 'middle', horizontal: 'center' };
  clockHead.border = BORDER;
  periods.forEach((period, index) => {
    const start = periodStart(bell, refDay, period, lunchAfter);
    const cell = clockRow.getCell(index + 2);
    cell.value = `${formatMinutes(start)}\n${formatMinutes(start + bell.lesson_minutes)}`;
    cell.font = { name: 'Calibri', size: 8, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });
  rowNo += 1;

  const bySlot = new Map();
  for (const lesson of lessons) {
    const key = `${lesson.day_of_week}:${lesson.period_no}`;
    const bucket = bySlot.get(key) || [];
    bucket.push(lesson);
    bySlot.set(key, bucket);
  }

  for (const day of days) {
    const row = ws.getRow(rowNo);
    row.height = 30;
    const name = row.getCell(1);
    name.value = DAY_NAMES[day] || String(day);
    name.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
    name.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    name.border = BORDER;
    periods.forEach((period, index) => {
      const cell = row.getCell(index + 2);
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const bucket = bySlot.get(`${day}:${period}`) || [];
      if (!bucket.length) return;
      cell.value = bucket
        .map((lesson) => {
          const subject = lesson.Assignment.Subject?.name || 'Ders';
          if (kind === 'classroom') {
            const who = teacherLine(lesson.Assignment, teachersById || new Map());
            return who ? `${who}\n${subject}` : subject;
          }
          return `${classroomLabel(lesson.Assignment.Classroom)}\n${subject}`;
        })
        .join('\n');
      cell.font = { name: 'Calibri', size: 8, color: { argb: INK } };
    });
    rowNo += 1;
  }
  rowNo += 1;

  const today = dateText(new Date());
  labelCell(
    ws,
    rowNo,
    1,
    Math.max(1, cols - 2),
    kind === 'classroom'
      ? `Yukarıdaki ders programı ${today} tarihinde düzenlenmiştir.`
      : `Yukarıdaki dersler ${today} tarihinde şahsınıza verilmiştir. Bilgilerinizi rica ederim.`,
  );
  labelCell(ws, rowNo, Math.max(2, cols - 1), cols, today).alignment = { horizontal: 'center' };
  rowNo += 1;
  labelCell(ws, rowNo, 1, Math.max(1, cols - 2), `Ders Programı Başlangıç Tarihi : ${today}`);
  labelCell(ws, rowNo, Math.max(2, cols - 1), cols, principalName || '').alignment = { horizontal: 'center' };
  rowNo += 1;
  labelCell(ws, rowNo, 1, Math.max(1, cols - 2), 'Aslını aldım.');
  labelCell(ws, rowNo, Math.max(2, cols - 1), cols, 'MÜDÜR', true).alignment = { horizontal: 'center' };
  rowNo += 2;

  const summaryHead = ['S. No', 'Yer Adı', kind === 'classroom' ? 'Öğretmen' : 'Sınıflar', 'Ders', 'Ders Adı', ...days.map((d) => DAY_SHORT[d] || String(d)), 'HS'];
  const headerRow = ws.getRow(rowNo);
  headerRow.height = 18;
  summaryHead.forEach((text, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = text;
    cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });
  rowNo += 1;

  const rows = detailRows(lessons, roomsById, { kind, teachersById });
  const dayTotals = new Map();
  rows.forEach((item, index) => {
    const row = ws.getRow(rowNo);
    const values = [index + 1, item.room, item.classroom, item.code, item.subject];
    values.forEach((value, col) => {
      const cell = row.getCell(col + 1);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 9, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', horizontal: col === 4 || col === 1 ? 'left' : 'center' };
      cell.border = BORDER;
    });
    days.forEach((day, col) => {
      const hours = item.byDay.get(day) || 0;
      if (hours) dayTotals.set(day, (dayTotals.get(day) || 0) + hours);
      const cell = row.getCell(6 + col);
      cell.value = hours || null;
      cell.font = { name: 'Calibri', size: 9, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER;
    });
    const total = row.getCell(6 + days.length);
    total.value = item.total;
    total.font = { name: 'Calibri', size: 9, color: { argb: INK } };
    total.alignment = { vertical: 'middle', horizontal: 'center' };
    total.border = BORDER;
    rowNo += 1;
  });

  const totalRow = ws.getRow(rowNo);
  const totalLabel = totalRow.getCell(5);
  totalLabel.value = 'Toplamlar';
  totalLabel.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
  totalLabel.alignment = { vertical: 'middle', horizontal: 'left' };
  totalLabel.border = BORDER;
  for (let col = 1; col <= 4; col += 1) totalRow.getCell(col).border = BORDER;
  days.forEach((day, col) => {
    const cell = totalRow.getCell(6 + col);
    cell.value = dayTotals.get(day) || null;
    cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });
  const grand = totalRow.getCell(6 + days.length);
  grand.value = lessons.length;
  grand.font = { name: 'Calibri', bold: true, size: 9, color: { argb: INK } };
  grand.alignment = { vertical: 'middle', horizontal: 'center' };
  grand.border = BORDER;

  ws.getColumn(1).width = 14;
  for (let i = 2; i <= cols; i += 1) ws.getColumn(i).width = 12;
  ws.getColumn(2).width = 16;
  ws.getColumn(5).width = 26;
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
}

function paintInk(cell, { bold = false, size = 8, align = 'center' } = {}) {
  cell.font = { name: 'Calibri', bold, size, color: { argb: INK } };
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true };
  cell.border = BORDER;
}

/** Çarşaf listenin bir bölümü: satır şube ya da öğretmen, sütun günün ders saatleri. */
function writeCarsafSection(ws, rowNo, heading, entities, mode, days, periods, lessons, teachersById, cols) {
  ws.mergeCells(rowNo, 1, rowNo, cols);
  const title = ws.getCell(rowNo, 1);
  title.value = heading;
  title.font = { name: 'Calibri', bold: true, size: 12, color: { argb: INK } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  rowNo += 1;

  const dayRowNo = rowNo;
  const periodRowNo = rowNo + 1;
  paintInk(ws.getCell(dayRowNo, 1), { bold: true, size: 8 });
  paintInk(ws.getCell(periodRowNo, 1), { bold: true, size: 7 });
  ws.getCell(dayRowNo, 1).value = mode === 'classroom' ? 'Şube' : 'Öğretmen';
  let col = 2;
  for (const day of days) {
    const start = col;
    for (const period of periods) {
      const cell = ws.getCell(periodRowNo, col);
      cell.value = period;
      paintInk(cell, { bold: true, size: 7 });
      col += 1;
    }
    if (col > start) {
      if (col - 1 > start) ws.mergeCells(dayRowNo, start, dayRowNo, col - 1);
      const dayCell = ws.getCell(dayRowNo, start);
      dayCell.value = DAY_SHORT[day] || DAY_NAMES[day] || String(day);
      paintInk(dayCell, { bold: true, size: 8 });
    }
  }
  ws.getRow(dayRowNo).height = 16;
  ws.getRow(periodRowNo).height = 14;
  rowNo += 2;

  for (const entity of entities) {
    const list = lessonsFor(mode, entity.id, lessons, null);
    const slots = new Map();
    for (const lesson of list) {
      const key = `${lesson.day_of_week}:${lesson.period_no}`;
      const bucket = slots.get(key) || [];
      bucket.push(lesson);
      slots.set(key, bucket);
    }
    const row = ws.getRow(rowNo);
    const name = row.getCell(1);
    name.value = entity.label;
    paintInk(name, { bold: true, size: 7, align: 'left' });
    let cursor = 2;
    for (const day of days) {
      for (const period of periods) {
        const cell = row.getCell(cursor);
        cell.value = carsafCell(slots.get(`${day}:${period}`) || [], mode, teachersById) || null;
        paintInk(cell, { size: 7 });
        cursor += 1;
      }
    }
    row.height = 16;
    rowNo += 1;
  }
  return rowNo;
}

/** Bütün şubeler ve bütün öğretmenler, tek A3 sayfaya sığacak çarşaf. */
function addCarsafSheet(workbook, usedNames, spec) {
  const { title, subtitle, days, periods, lessons, teachersById } = spec;
  const classLabels = new Map();
  for (const lesson of lessons) {
    if (lesson.Assignment?.Classroom) {
      classLabels.set(lesson.Assignment.classroom_id, classroomLabel(lesson.Assignment.Classroom));
    }
  }
  const classes = entitiesOf('classroom', lessons, [], teachersById, new Map(), classLabels);
  const teachers = entitiesOf('teacher', lessons, [], teachersById, new Map(), classLabels);
  const cols = 1 + days.length * periods.length;
  const ws = workbook.addWorksheet(sheetName('Çarşaf liste', usedNames), {
    pageSetup: {
      paperSize: 8,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
    },
  });
  ws.mergeCells(1, 1, 1, cols);
  ws.mergeCells(2, 1, 2, cols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: INK } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 10, color: { argb: INK } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 16;

  let rowNo = writeCarsafSection(ws, 4, 'Şubeler', classes, 'classroom', days, periods, lessons, teachersById, cols);
  writeCarsafSection(ws, rowNo + 1, 'Öğretmenler', teachers, 'teacher', days, periods, lessons, teachersById, cols);

  ws.getColumn(1).width = 22;
  for (let i = 2; i <= cols; i += 1) ws.getColumn(i).width = 8;
  ws.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 };
}

/**
 * Hazır ders programını şube, öğretmen, öğrenci veya mekân ızgarası olarak xlsx yazar.
 * Öğrenci sayfasında seçmeli ders, şubede seçim varsa yalnız o öğrencinin seçtikleridir.
 * Çarşaf liste bütün şubeleri ve öğretmenleri tek sayfada toplar.
 */
function exportPlans({
  project,
  schoolName,
  view,
  entityId,
  lessons,
  teachersById,
  roomsById,
  students,
  choiceRows,
  orgLines,
  principalName,
}) {
  const usable = lessons.filter((l) => l.Assignment);
  if (!usable.length) throw httpError(400, 'Henüz taslak program yok');

  const days = [...(project.days || [])].sort((a, b) => a - b);
  const periods = Array.from({ length: project.periods_per_day || 0 }, (_, i) => i + 1);
  const bell = bellOf(project.settings);
  const year = project.academic_year ? String(project.academic_year) : '';
  const status = STATUS_LABEL[project.status] || '';
  const head = [schoolName, project.name].filter(Boolean).join(' — ');

  if (view === 'carsaf') {
    if (!days.length || !periods.length) throw httpError(400, 'Okul saatleri tanımlı değil');
    return [{
      type: 'carsaf',
      title: head || 'Ders programı',
      subtitle: [year, status, 'Tüm şubeler ve tüm öğretmenler'].filter(Boolean).join('  ·  '),
      days,
      periods,
      lessons: usable,
      teachersById,
    }];
  }

  // Ayrıntılı program ilgili listenin sayfa düzenidir.
  const detailedKind = DETAIL_KIND[view] || null;
  const baseView = detailedKind || view;

  const classLabels = new Map();
  for (const lesson of usable) {
    const assignment = lesson.Assignment;
    if (assignment.Classroom) classLabels.set(assignment.classroom_id, classroomLabel(assignment.Classroom));
  }
  const choiceCtx = choiceIndex(choiceRows || []);
  let entities = entitiesOf(baseView, usable, students || [], teachersById, roomsById, classLabels);
  if (entityId != null) entities = entities.filter((entity) => entity.key === Number(entityId));
  if (!entities.length) {
    if (entityId != null) throw httpError(400, 'Seçilen kayıt için hazır program yok');
    if (baseView === 'room') throw httpError(400, 'Programda mekan atanmış ders yok');
    if (baseView === 'student') throw httpError(400, 'Bu şubelerde kayıtlı öğrenci yok');
    throw httpError(400, 'Hazır program bulunamadı');
  }

  const plans = [];
  for (const entity of entities) {
    const owner = baseView === 'student' ? entity.id : null;
    const list = lessonsFor(baseView, baseView === 'student' ? owner : entity.id, usable, choiceCtx);

    if (detailedKind) {
      plans.push({
        type: 'detail',
        sheet: entity.sheet,
        orgLines,
        kind: detailedKind,
        ownerLabel: entity.label,
        teacherLabel: entity.label,
        days,
        periods,
        bell,
        lunchAfter: detailedKind === 'classroom' ? lunchAfterFor(project, entity.id) : project.lunch_after || null,
        lessons: list,
        roomsById,
        teachersById,
        principalName,
      });
      continue;
    }

    const slots = new Map();
    for (const lesson of list) {
      const key = `${lesson.day_of_week}:${lesson.period_no}`;
      const bucket = slots.get(key) || [];
      bucket.push(describeLesson(lesson, baseView, teachersById, roomsById));
      slots.set(key, bucket);
    }
    for (const bucket of slots.values()) bucket.sort((a, b) => trSort(a.title, b.title));

    const lunchClassroom = baseView === 'classroom' ? entity.id : baseView === 'student' ? owner.classroom_id : null;
    const kind =
      baseView === 'classroom' ? 'Şube' : baseView === 'teacher' ? 'Öğretmen' : baseView === 'student' ? 'Öğrenci' : 'Mekan';
    const bits = [`${kind}: ${entity.label}`, year, status, `${list.length} ders saati`].filter(Boolean);
    let footnote = '';
    if (baseView === 'classroom') footnote = 'Aynı saatteki seçmeli dersler birlikte yazılır.';
    if (baseView === 'student') {
      const classHas = choiceCtx.classesWithChoices.has(owner.classroom_id);
      const picked = choiceCtx.countByStudent.get(owner.id) || 0;
      footnote = classHas && !picked
        ? 'Bu öğrenci için seçmeli ders seçimi girilmemiş; seçmeli saatler boş bırakıldı.'
        : 'Seçmeli dersler öğrencinin kayıtlı seçimine göredir. Seçim girilmemiş şubede seçmeliler birlikte gösterilir.';
    }

    plans.push({
      type: 'grid',
      sheet: entity.sheet,
      title: head || 'Ders programı',
      subtitle: bits.join('  ·  '),
      footnote,
      days,
      periods,
      bell,
      lunchAfter: lunchAfterFor(project, lunchClassroom),
      slots,
    });
  }

  return plans;
}

function buildTimetableWorkbook(args) {
  const plans = exportPlans(args);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Libs';
  workbook.created = new Date();
  const usedNames = new Set();
  for (const plan of plans) {
    if (plan.type === 'carsaf') addCarsafSheet(workbook, usedNames, plan);
    else if (plan.type === 'detail') addTeacherDetailSheet(workbook, usedNames, plan);
    else addGridSheet(workbook, usedNames, plan);
  }
  return workbook;
}

function pdfRow(doc, fonts, x, y, widths, cells, { bold = false, size = 8, height = 16, lineBreak = true } = {}) {
  let cursor = x;
  const font = bold ? fonts.bold : fonts.regular;
  cells.forEach((text, index) => {
    const w = widths[index] ?? widths[widths.length - 1];
    doc.lineWidth(0.4).strokeColor('#000000').rect(cursor, y, w, height).stroke();
    doc.font(font).fontSize(size).fillColor('#000000');
    doc.text(text == null ? '' : String(text), cursor + 1, y + 1, {
      width: Math.max(1, w - 2),
      height: Math.max(1, height - 2),
      align: 'center',
      lineBreak,
      ellipsis: !lineBreak,
    });
    cursor += w;
  });
  return y + height;
}

function slotPlain(items) {
  return items.map((item) => [item.title, ...(item.lines || [])].filter(Boolean).join('\n')).join('\n');
}

function paintGridPdf(doc, fonts, spec) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  doc.font(fonts.bold).fontSize(12).fillColor('#000000').text(spec.title || 'Ders programı', left, doc.page.margins.top, { width });
  doc.font(fonts.regular).fontSize(8).text(spec.subtitle || '', left, doc.y + 2, { width });
  let y = doc.y + 8;
  const firstW = 64;
  const rest = (width - firstW) / Math.max(spec.days.length, 1);
  const widths = [firstW, ...spec.days.map(() => rest)];
  const headers = ['Saat', ...spec.days.map((day) => DAY_NAMES[day] || String(day))];
  if (y + 16 > bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y = pdfRow(doc, fonts, left, y, widths, headers, { bold: true, size: 8, height: 16 });
  const refDay = spec.days[0] || 1;
  for (const period of spec.periods) {
    if (spec.lunchAfter && period === spec.lunchAfter + 1) {
      if (y + 12 > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      y = pdfRow(doc, fonts, left, y, [width], ['Öğle arası'], { size: 8, height: 12 });
    }
    const cells = [`${period}\n${periodRange(spec.bell, refDay, period, spec.lunchAfter)}`];
    let lines = 2;
    for (const day of spec.days) {
      const text = slotPlain(spec.slots.get(`${day}:${period}`) || []);
      lines = Math.max(lines, text ? text.split('\n').length : 1);
      cells.push(text);
    }
    const height = Math.min(70, Math.max(20, lines * 8));
    if (y + height > bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    y = pdfRow(doc, fonts, left, y, widths, cells, { size: 7, height });
  }
  if (spec.footnote) {
    doc.font(fonts.regular).fontSize(8).fillColor('#000000').text(spec.footnote, left, y + 6, { width });
  }
}

function paintDetailPdf(doc, fonts, spec) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const kind = spec.kind || 'teacher';
  const owner = spec.ownerLabel || spec.teacherLabel || '';
  let y = doc.page.margins.top;
  for (const line of spec.orgLines || []) {
    doc.font(fonts.bold).fontSize(10).fillColor('#000000').text(line, left, y, { width, align: 'center' });
    y = doc.y + 1;
  }
  y += 6;
  doc.font(fonts.bold).fontSize(9).text(kind === 'classroom' ? `Sınıf : ${owner}` : `Adı Soyadı : ${owner}`, left, y, { width });
  y = doc.y + 8;

  const labelW = 72;
  const cellW = (width - labelW) / Math.max(spec.periods.length, 1);
  const widths = [labelW, ...spec.periods.map(() => cellW)];
  y = pdfRow(doc, fonts, left, y, widths, ['Ders\\Gün', ...spec.periods.map((period) => `(${period})`)], { bold: true, size: 7, height: 14 });
  const refDay = spec.days[0] || 1;
  y = pdfRow(
    doc,
    fonts,
    left,
    y,
    widths,
    ['Saat', ...spec.periods.map((period) => {
      const start = periodStart(spec.bell, refDay, period, spec.lunchAfter);
      return `${formatMinutes(start)}–${formatMinutes(start + spec.bell.lesson_minutes)}`;
    })],
    { size: 6, height: 16 },
  );

  const bySlot = new Map();
  for (const lesson of spec.lessons) {
    const key = `${lesson.day_of_week}:${lesson.period_no}`;
    const bucket = bySlot.get(key) || [];
    bucket.push(lesson);
    bySlot.set(key, bucket);
  }
  for (const day of spec.days) {
    const cells = [DAY_NAMES[day] || String(day)];
    let lines = 1;
    for (const period of spec.periods) {
      const text = (bySlot.get(`${day}:${period}`) || [])
        .map((lesson) => {
          const subject = lesson.Assignment.Subject?.name || 'Ders';
          if (kind === 'classroom') {
            const who = teacherLine(lesson.Assignment, spec.teachersById || new Map());
            return who ? `${who}\n${subject}` : subject;
          }
          return `${classroomLabel(lesson.Assignment.Classroom)}\n${subject}`;
        })
        .join('\n');
      lines = Math.max(lines, text ? text.split('\n').length : 1);
      cells.push(text);
    }
    const height = Math.min(46, Math.max(16, lines * 8));
    if (y + height > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    y = pdfRow(doc, fonts, left, y, widths, cells, { size: 6, height });
  }

  y += 8;
  const today = dateText(new Date());
  const letter = kind === 'classroom'
    ? `Yukarıdaki ders programı ${today} tarihinde düzenlenmiştir.`
    : `Yukarıdaki dersler ${today} tarihinde şahsınıza verilmiştir. Bilgilerinizi rica ederim.`;
  if (y + 40 > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  doc.font(fonts.regular).fontSize(8).fillColor('#000000').text(letter, left, y, { width: width * 0.68 });
  doc.font(fonts.regular).fontSize(8).text(today, left + width * 0.7, y, { width: width * 0.3, align: 'center' });
  doc.font(fonts.regular).fontSize(8).text(spec.principalName || '', left + width * 0.7, doc.y + 2, { width: width * 0.3, align: 'center' });
  doc.font(fonts.bold).fontSize(8).text('MÜDÜR', left + width * 0.7, doc.y + 1, { width: width * 0.3, align: 'center' });
  y = doc.y + 10;

  const rows = detailRows(spec.lessons, spec.roomsById, { kind, teachersById: spec.teachersById });
  const summaryHead = ['S.No', 'Yer', kind === 'classroom' ? 'Öğretmen' : 'Sınıflar', 'Ders', ...spec.days.map((day) => DAY_SHORT[day] || String(day)), 'HS'];
  const summaryW = width / summaryHead.length;
  const sw = summaryHead.map(() => summaryW);
  if (y + 14 > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y = pdfRow(doc, fonts, left, y, sw, summaryHead, { bold: true, size: 6, height: 14 });
  rows.forEach((item, index) => {
    const values = [
      String(index + 1),
      item.room,
      item.classroom,
      item.subject,
      ...spec.days.map((day) => String(item.byDay.get(day) || '')),
      String(item.total),
    ];
    if (y + 12 > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    y = pdfRow(doc, fonts, left, y, sw, values, { size: 6, height: 12 });
  });
}

function paintCarsafPdf(doc, fonts, spec) {
  const { title, subtitle, days, periods, lessons, teachersById } = spec;
  const classLabels = new Map();
  for (const lesson of lessons) {
    if (lesson.Assignment?.Classroom) classLabels.set(lesson.Assignment.classroom_id, classroomLabel(lesson.Assignment.Classroom));
  }
  const classes = entitiesOf('classroom', lessons, [], teachersById, new Map(), classLabels);
  const teachers = entitiesOf('teacher', lessons, [], teachersById, new Map(), classLabels);
  const left = 12;
  const width = doc.page.width - 24;
  const height = doc.page.height - 24;
  const colCount = 1 + days.length * periods.length;
  const nameW = Math.min(86, width * 0.16);
  const cellW = (width - nameW) / Math.max(colCount - 1, 1);
  const widths = [nameW, ...Array.from({ length: colCount - 1 }, () => cellW)];
  const sections = [
    ['Şubeler', classes, 'classroom'],
    ['Öğretmenler', teachers, 'teacher'],
  ];
  const rowCount = 2 + sections.reduce((sum, [, entities]) => sum + 4 + entities.length, 0);
  const rowH = Math.max(6, Math.min(13, (height - 8) / Math.max(rowCount, 1)));
  const fontSize = Math.max(4, Math.min(7, rowH - 1.5));
  let y = 12;
  doc.font(fonts.bold).fontSize(Math.min(11, rowH + 3)).fillColor('#000000').text(title || 'Ders programı', left, y, {
    width,
    align: 'center',
    lineBreak: false,
  });
  y += rowH + 3;
  doc.font(fonts.regular).fontSize(Math.min(8, fontSize + 1)).text(subtitle || '', left, y, { width, align: 'center', lineBreak: false });
  y += rowH + 4;

  const drawSection = (heading, entities, mode) => {
    doc.font(fonts.bold).fontSize(Math.min(9, fontSize + 2)).fillColor('#000000').text(heading, left, y, { width, lineBreak: false });
    y += rowH;
    let x = left + nameW;
    doc.lineWidth(0.4).strokeColor('#000000').rect(left, y, nameW, rowH).stroke();
    doc.font(fonts.bold).fontSize(fontSize).text(mode === 'classroom' ? 'Şube' : 'Öğretmen', left + 1, y + 1, {
      width: nameW - 2,
      height: rowH - 1,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
    for (const day of days) {
      const span = cellW * periods.length;
      doc.rect(x, y, span, rowH).stroke();
      doc.font(fonts.bold).fontSize(fontSize).text(DAY_SHORT[day] || String(day), x, y + 1, {
        width: span,
        height: rowH - 1,
        align: 'center',
        lineBreak: false,
      });
      x += span;
    }
    y += rowH;
    y = pdfRow(doc, fonts, left, y, widths, ['', ...days.flatMap(() => periods.map((period) => String(period)))], {
      bold: true,
      size: fontSize,
      height: rowH,
      lineBreak: false,
    });
    for (const entity of entities) {
      const list = lessonsFor(mode, entity.id, lessons, null);
      const slots = new Map();
      for (const lesson of list) {
        const key = `${lesson.day_of_week}:${lesson.period_no}`;
        const bucket = slots.get(key) || [];
        bucket.push(lesson);
        slots.set(key, bucket);
      }
      const cells = [entity.label];
      for (const day of days) {
        for (const period of periods) cells.push(carsafCell(slots.get(`${day}:${period}`) || [], mode, teachersById));
      }
      y = pdfRow(doc, fonts, left, y, widths, cells, { size: fontSize, height: rowH, lineBreak: false });
    }
    y += Math.max(4, rowH / 2);
  };

  for (const [heading, entities, mode] of sections) drawSection(heading, entities, mode);
}

function renderLessonsPdf(args) {
  const plans = exportPlans(args);
  const page = args.view === 'carsaf' ? 'A3' : 'A4';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 18, size: page, layout: 'landscape' });
    const fonts = registerUnicodeFonts(doc);
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    plans.forEach((plan, index) => {
      if (index > 0) doc.addPage();
      if (plan.type === 'carsaf') paintCarsafPdf(doc, fonts, plan);
      else if (plan.type === 'detail') paintDetailPdf(doc, fonts, plan);
      else paintGridPdf(doc, fonts, plan);
    });
    doc.end();
  });
}

async function writeLessonsExport(res, project, query) {
  const view = String(query.view || '');
  const format = String(query.format || 'xlsx').toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) throw httpError(400, 'Dosya biçimi Excel veya PDF olmalı');
  if (!VIEWS.includes(view)) throw httpError(400, 'Çıktı türü şube, öğretmen, öğrenci, mekan veya çarşaf liste olmalı');
  let entityId = null;
  if (query.entity_id != null && query.entity_id !== '') {
    entityId = Number(query.entity_id);
    if (!Number.isInteger(entityId) || entityId < 1) throw httpError(400, 'Geçersiz kayıt');
  }

  const lessonRows = await TimetableLesson.findAll({
    where: { project_id: project.id },
    include: [
      {
        model: TimetableAssignment,
        as: 'Assignment',
        include: [
          { model: Classroom, attributes: ['id', 'class_level', 'section'] },
          { model: Subject, attributes: ['id', 'name', 'code'] },
          { model: Teacher, as: 'Teacher', attributes: ['id', 'first_name', 'last_name'] },
          { model: TimetableRoom, as: 'Room', attributes: ['id', 'name'] },
        ],
      },
    ],
    order: [['day_of_week', 'ASC'], ['period_no', 'ASC']],
  });
  const lessons = lessonRows.map((row) => row.toJSON());
  if (!lessons.length) throw httpError(400, 'Henüz taslak program yok');

  const teacherIds = new Set();
  const classIds = new Set();
  for (const lesson of lessons) {
    if (!lesson.Assignment) continue;
    classIds.add(lesson.Assignment.classroom_id);
    for (const id of assignmentTeacherIds(lesson.Assignment)) teacherIds.add(id);
  }

  const [teacherRows, roomRows, school, principalName, choiceRows, studentRows] = await Promise.all([
    teacherIds.size
      ? Teacher.findAll({ where: { id: [...teacherIds] }, attributes: ['id', 'first_name', 'last_name'] })
      : [],
    TimetableRoom.findAll({
      where: { tenant_id: project.tenant_id, school_id: project.school_id },
      attributes: ['id', 'name'],
    }),
    School.findByPk(project.school_id, {
      attributes: ['name'],
      include: [
        { model: District, attributes: ['name'] },
        { model: Province, attributes: ['name'] },
      ],
    }),
    view === 'teacher_detail' || view === 'classroom_detail'
      ? resolvePrincipalName(project.tenant_id, project.school_id)
      : '',
    view === 'student'
      ? TimetableElectiveChoice.findAll({
          where: { project_id: project.id },
          include: [{ model: TimetableAssignment, attributes: ['id', 'classroom_id'] }],
        })
      : [],
    view === 'student' && classIds.size
      ? Student.findAll({
          where: {
            tenant_id: project.tenant_id,
            classroom_id: [...classIds],
            [Op.or]: [{ registration_status: null }, { registration_status: 'aktif' }],
          },
          attributes: ['id', 'student_number', 'first_name', 'last_name', 'classroom_id', 'class_level', 'section'],
        })
      : [],
  ]);

  const teachersById = new Map(teacherRows.map((row) => [row.id, row]));
  const roomsById = new Map(roomRows.map((row) => [row.id, row]));
  const choices = (choiceRows || []).map((row) => ({
    assignment_id: row.assignment_id,
    student_id: row.student_id,
    classroom_id: row.TimetableAssignment?.classroom_id || null,
  }));

  const pack = {
    project,
    schoolName: school?.name || '',
    view,
    entityId,
    lessons,
    teachersById,
    roomsById,
    students: studentRows.map((row) => row.toJSON()),
    choiceRows: choices,
    orgLines: organizationLines(school),
    principalName,
  };
  const base = FILE_BASE[view][entityId && view !== 'carsaf' ? 0 : 1];
  if (format === 'pdf') {
    const buffer = await renderLessonsPdf(pack);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    return res.end(buffer);
  }
  const workbook = buildTimetableWorkbook(pack);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
}

module.exports = { buildTimetableWorkbook, renderLessonsPdf, writeLessonsExport, VIEWS };
