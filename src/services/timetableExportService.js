'use strict';

const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  TimetableLesson,
  TimetableAssignment,
  TimetableRoom,
  TimetableAvailability,
  TimetableElectiveChoice,
  Classroom,
  Subject,
  Teacher,
  Student,
  School,
} = require('../models');
const { classroomLabel, teacherName, assignmentTeacherIds } = require('./timetableBuildService');

const VIEWS = ['classroom', 'teacher', 'student', 'room'];
const DAY_NAMES = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};
const STATUS_LABEL = { taslak: 'Taslak', yayinda: 'Yayında', arsiv: 'Arşiv' };
const FILE_BASE = {
  classroom: ['ders-programi-sube', 'ders-programi-subeler'],
  teacher: ['ders-programi-ogretmen', 'ders-programi-ogretmenler'],
  student: ['ders-programi-ogrenci', 'ders-programi-ogrenciler'],
  room: ['ders-programi-mekan', 'ders-programi-mekanlar'],
};
const FILLS = ['E8F5E9', 'E3F2FD', 'FFF3E0', 'F3E5F5', 'E0F7FA', 'FFF8E1', 'FCE4EC', 'E8EAF6', 'F1F8E9', 'EDE7F6'];
const THIN = { style: 'thin', color: { argb: 'FFD0D7DE' } };
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
    day_breaks: Array.isArray(bell.day_breaks) ? bell.day_breaks : [],
  };
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
    const extra = bell.day_breaks.find((item) => item.day === day && item.after_period === current);
    const lunch = lunchAfter === current ? Math.max(bell.break_minutes, 30) : bell.break_minutes;
    cursor += extra ? extra.minutes : lunch;
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

function cellState(availability, entityType, entityId) {
  const out = {};
  for (const row of availability) {
    const match = row.entity_type === 'school' || (row.entity_type === entityType && row.entity_id === entityId);
    if (!match) continue;
    for (const [key, value] of Object.entries(row.cells || {})) {
      if (out[key] !== 'closed') out[key] = value;
    }
  }
  return out;
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
    rich.push({ font: { name: 'Calibri', size: 8, color: { argb: 'FF8C8C8C' } }, text: `${timeNote}\n` });
  }
  items.forEach((item, index) => {
    if (index > 0) rich.push({ font: { name: 'Calibri', size: 8, color: { argb: 'FFBFBFBF' } }, text: '\n—\n' });
    rich.push({ font: { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1F1F1F' } }, text: item.title });
    if (item.lines.length) {
      rich.push({ font: { name: 'Calibri', size: 9, color: { argb: 'FF595959' } }, text: `\n${item.lines.join('\n')}` });
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
    closed,
    avoid,
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
  titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1F4E79' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E3F0' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 20;

  const header = ws.getRow(3);
  header.height = 22;
  const headers = ['Saat', ...days.map((day) => DAY_NAMES[day] || String(day))];
  headers.forEach((text, index) => {
    const cell = header.getCell(index + 1);
    cell.value = text;
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
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
      lunch.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF595959' } };
      lunch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      lunch.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(rowNo).height = 16;
      rowNo += 1;
    }

    const row = ws.getRow(rowNo);
    const baseRange = periodRange(bell, refDay, period, lunchAfter);
    const hour = row.getCell(1);
    hour.value = `${period}\n${baseRange}`;
    hour.font = { name: 'Calibri', bold: true, size: 10 };
    hour.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FB' } };
    hour.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    hour.border = BORDER;

    let maxLines = 2;
    days.forEach((day, index) => {
      const cell = row.getCell(index + 2);
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const key = `${day}:${period}`;
      const items = slots.get(key) || [];
      const stateKey = `${day}-${period}`;
      if (items.length) {
        const range = periodRange(bell, day, period, lunchAfter);
        const timeNote = range === baseRange ? '' : range;
        cell.value = richLesson(items, timeNote);
        if (items.length === 1) {
          const color = FILLS[(items[0].fillId || 0) % FILLS.length];
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
        }
        maxLines = Math.max(maxLines, lineCount(items) + (timeNote ? 1 : 0));
        return;
      }
      if (closed[stateKey] === 'closed') {
        cell.value = 'Kapalı';
        cell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF8C8C8C' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        return;
      }
      if (avoid[stateKey] === 'avoid') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      }
    });
    row.height = Math.min(96, Math.max(36, maxLines * 15));
    rowNo += 1;
  }

  if (footnote) {
    ws.mergeCells(rowNo, 1, rowNo, cols);
    const note = ws.getCell(rowNo, 1);
    note.value = footnote;
    note.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF595959' } };
    note.alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(rowNo).height = 32;
  }

  ws.getColumn(1).width = 16;
  for (let i = 2; i <= cols; i += 1) ws.getColumn(i).width = 24;
  ws.pageSetup.printTitlesRow = '1:3';
  ws.headerFooter.oddFooter = `&L${title}&RSayfa &P / &N`;
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.55, header: 0.2, footer: 0.25 };
}

/**
 * Hazır ders programını şube, öğretmen, öğrenci veya mekân ızgarası olarak xlsx yazar.
 * Öğrenci sayfasında seçmeli ders, şubede seçim varsa yalnız o öğrencinin seçtikleridir.
 */
function buildTimetableWorkbook({
  project,
  schoolName,
  view,
  entityId,
  lessons,
  teachersById,
  roomsById,
  students,
  choiceRows,
  availability,
}) {
  const usable = lessons.filter((l) => l.Assignment);
  if (!usable.length) throw httpError(400, 'Henüz taslak program yok');

  const classLabels = new Map();
  for (const lesson of usable) {
    const assignment = lesson.Assignment;
    if (assignment.Classroom) classLabels.set(assignment.classroom_id, classroomLabel(assignment.Classroom));
  }
  const choiceCtx = choiceIndex(choiceRows || []);
  let entities = entitiesOf(view, usable, students || [], teachersById, roomsById, classLabels);
  if (entityId != null) entities = entities.filter((entity) => entity.key === Number(entityId));
  if (!entities.length) {
    if (entityId != null) throw httpError(400, 'Seçilen kayıt için hazır program yok');
    if (view === 'room') throw httpError(400, 'Programda mekan atanmış ders yok');
    if (view === 'student') throw httpError(400, 'Bu şubelerde kayıtlı öğrenci yok');
    throw httpError(400, 'Hazır program bulunamadı');
  }

  const days = [...(project.days || [])].sort((a, b) => a - b);
  const periods = Array.from({ length: project.periods_per_day || 0 }, (_, i) => i + 1);
  const bell = bellOf(project.settings);
  const year = project.academic_year ? String(project.academic_year) : '';
  const status = STATUS_LABEL[project.status] || '';
  const head = [schoolName, project.name].filter(Boolean).join(' — ');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Libs';
  workbook.created = new Date();
  const usedNames = new Set();

  for (const entity of entities) {
    const owner = view === 'student' ? entity.id : null;
    const list = lessonsFor(view, view === 'student' ? owner : entity.id, usable, choiceCtx);
    const slots = new Map();
    for (const lesson of list) {
      const key = `${lesson.day_of_week}:${lesson.period_no}`;
      const bucket = slots.get(key) || [];
      bucket.push(describeLesson(lesson, view, teachersById, roomsById));
      slots.set(key, bucket);
    }
    for (const bucket of slots.values()) bucket.sort((a, b) => trSort(a.title, b.title));

    const availType = view === 'student' ? 'classroom' : view;
    const availId = view === 'student' ? owner.classroom_id : entity.id;
    const states = cellState(availability, availType, availId);
    const closed = {};
    const avoid = {};
    for (const [key, value] of Object.entries(states)) {
      if (value === 'closed') closed[key] = 'closed';
      if (value === 'avoid') avoid[key] = 'avoid';
    }

    const lunchClassroom = view === 'classroom' ? entity.id : view === 'student' ? owner.classroom_id : null;
    const kind = view === 'classroom' ? 'Şube' : view === 'teacher' ? 'Öğretmen' : view === 'student' ? 'Öğrenci' : 'Mekan';
    const bits = [`${kind}: ${entity.label}`, year, status, `${list.length} ders saati`].filter(Boolean);
    let footnote = '';
    if (view === 'classroom') footnote = 'Aynı saatteki seçmeli dersler birlikte yazılır.';
    if (view === 'student') {
      const classHas = choiceCtx.classesWithChoices.has(owner.classroom_id);
      const picked = choiceCtx.countByStudent.get(owner.id) || 0;
      footnote = classHas && !picked
        ? 'Bu öğrenci için seçmeli ders seçimi girilmemiş; seçmeli saatler boş bırakıldı.'
        : 'Seçmeli dersler öğrencinin kayıtlı seçimine göredir. Seçim girilmemiş şubede seçmeliler birlikte gösterilir.';
    }

    addGridSheet(workbook, usedNames, {
      sheet: entity.sheet,
      title: head || 'Ders programı',
      subtitle: bits.join('  ·  '),
      footnote,
      days,
      periods,
      bell,
      lunchAfter: lunchAfterFor(project, lunchClassroom),
      slots,
      closed,
      avoid,
    });
  }

  return workbook;
}

async function writeLessonsExport(res, project, query) {
  const view = String(query.view || '');
  if (!VIEWS.includes(view)) throw httpError(400, 'Çıktı türü şube, öğretmen, öğrenci veya mekan olmalı');
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
          { model: Subject, attributes: ['id', 'name'] },
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

  const [teacherRows, roomRows, school, availabilityRows, choiceRows, studentRows] = await Promise.all([
    teacherIds.size
      ? Teacher.findAll({ where: { id: [...teacherIds] }, attributes: ['id', 'first_name', 'last_name'] })
      : [],
    TimetableRoom.findAll({
      where: { tenant_id: project.tenant_id, school_id: project.school_id },
      attributes: ['id', 'name'],
    }),
    School.findByPk(project.school_id, { attributes: ['name'] }),
    TimetableAvailability.findAll({ where: { project_id: project.id }, attributes: ['entity_type', 'entity_id', 'cells'] }),
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

  const workbook = buildTimetableWorkbook({
    project,
    schoolName: school?.name || '',
    view,
    entityId,
    lessons,
    teachersById,
    roomsById,
    students: studentRows.map((row) => row.toJSON()),
    choiceRows: choices,
    availability: availabilityRows.map((row) => row.toJSON()),
  });

  const base = FILE_BASE[view][entityId ? 0 : 1];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
}

module.exports = { buildTimetableWorkbook, writeLessonsExport, VIEWS };
