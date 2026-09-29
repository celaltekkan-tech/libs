'use strict';

const {
  TimetableAssignment,
  TimetableConstraint,
  TimetableRoom,
  TimetableLesson,
  TimetableAvailability,
  TimetableElectiveChoice,
  Classroom,
  Subject,
  Teacher,
} = require('../models');

const DEFAULT_SETTINGS = {
  time_limit: 60,
  max_subject_daily: 2,
  max_culture_daily: 2,
  max_vocational_daily: 8,
  weights: {
    teacher_gaps: 10,
    class_compact: 60,
    teacher_single_hour_day: 6,
    hard_subject_late: 3,
    soft_constraint: 20,
    availability_avoid: 15,
    block_flex: 8,
  },
  // Bloklar öğle arasını aşabilir mi (false: hiçbir blok bölünmez)
  block_across_lunch: false,
  // Şubeye özel öğle arası: { [classroom_id]: kaçıncı saatten sonra }
  class_lunch: {},
};

const AVAILABILITY_TYPES = ['school', 'teacher', 'classroom', 'room', 'subject'];
const CELL_STATES = ['closed', 'avoid'];

function projectSettings(project) {
  const s = project.settings || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    max_culture_daily: s.max_culture_daily ?? s.max_subject_daily ?? DEFAULT_SETTINGS.max_culture_daily,
    max_vocational_daily: s.max_vocational_daily ?? DEFAULT_SETTINGS.max_vocational_daily,
    weights: { ...DEFAULT_SETTINGS.weights, ...(s.weights || {}) },
  };
}

function parseBlockPattern(pattern) {
  if (!pattern) return null;
  const parts = String(pattern)
    .split(/[+,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
  return parts.length ? parts : null;
}

function classroomLabel(c) {
  return c ? `${c.class_level}/${c.section}` : '';
}

function teacherName(t) {
  return t ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : '';
}

/** 1. öğretmen + ortak öğretmenler (tekrarsız). */
function assignmentTeacherIds(a) {
  const out = [];
  for (const id of [a.teacher_id, ...(a.co_teacher_ids || [])]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** "gün-saat" anahtarlı hücre haritasını solver'ın [[d,p]] listelerine çevirir. */
function cellsToLists(cells) {
  const out = { closed: [], avoid: [] };
  for (const [key, state] of Object.entries(cells || {})) {
    if (!CELL_STATES.includes(state)) continue;
    const [d, p] = key.split('-').map(Number);
    if (Number.isInteger(d) && Number.isInteger(p)) out[state].push([d, p]);
  }
  return out;
}

/**
 * Öğrenci seçimlerinden şube başına tekil "profil" listesi: her öğrencinin aldığı
 * seçmeli atamaların kümesi. Solver bu profillere göre öğrenci çakışmasını denetler.
 */
function electiveProfiles(assignments, choices) {
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const perStudent = new Map();
  for (const c of choices) {
    const a = byId.get(c.assignment_id);
    if (!a || !a.elective_group) continue;
    const key = `${a.classroom_id}:${c.student_id}`;
    const list = perStudent.get(key) || [];
    list.push(a.id);
    perStudent.set(key, list);
  }
  const out = {};
  const seen = new Set();
  for (const [key, ids] of perStudent.entries()) {
    const classroomId = key.split(':')[0];
    const sorted = [...new Set(ids)].sort((x, y) => x - y);
    const sig = `${classroomId}|${sorted.join(',')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    (out[classroomId] ||= []).push(sorted);
  }
  return out;
}

/** Projenin atama/mekan/öğretmen/şube/ders kayıtlarını tek seferde yükler. */
async function loadProjectData(project) {
  const [assignments, constraints, rooms, lessons, availability, choices] = await Promise.all([
    TimetableAssignment.findAll({
      where: { project_id: project.id },
      include: [
        { model: Classroom, attributes: ['id', 'class_level', 'section'] },
        { model: Subject, attributes: ['id', 'name', 'difficulty_level', 'allow_split', 'allow_merge', 'course_kind'] },
        { model: Teacher, as: 'Teacher', attributes: ['id', 'first_name', 'last_name', 'brans'] },
      ],
      order: [['id', 'ASC']],
    }),
    TimetableConstraint.findAll({ where: { project_id: project.id }, order: [['id', 'ASC']] }),
    TimetableRoom.findAll({ where: { tenant_id: project.tenant_id, school_id: project.school_id }, order: [['name', 'ASC']] }),
    TimetableLesson.findAll({ where: { project_id: project.id } }),
    TimetableAvailability.findAll({ where: { project_id: project.id } }),
    TimetableElectiveChoice.findAll({
      where: { project_id: project.id },
      attributes: ['assignment_id', 'student_id'],
    }),
  ]);
  return { assignments, constraints, rooms, lessons, availability, choices };
}

/** Çözücüye gönderilecek JSON'u üretir (solver/timetable_model.py girdisi). */
async function buildPayload(project, { timeLimit } = {}) {
  const settings = projectSettings(project);
  const { assignments, constraints, rooms, lessons, availability, choices } = await loadProjectData(project);

  const classrooms = new Map();
  const teachers = new Map();
  const subjects = new Map();
  const coIds = new Set();
  for (const a of assignments) {
    if (a.Classroom) classrooms.set(a.classroom_id, { id: a.classroom_id, label: classroomLabel(a.Classroom) });
    if (a.Teacher) teachers.set(a.teacher_id, { id: a.teacher_id, name: teacherName(a.Teacher) });
    for (const id of a.co_teacher_ids || []) coIds.add(id);
    if (a.Subject) {
      subjects.set(a.subject_id, {
        id: a.subject_id,
        name: a.Subject.name,
        hard: a.Subject.difficulty_level === 'zor',
        vocational: a.Subject.course_kind === 'meslek',
      });
    }
  }

  const missingCo = [...coIds].filter((id) => !teachers.has(id));
  if (missingCo.length) {
    const rows = await Teacher.findAll({ where: { id: missingCo }, attributes: ['id', 'first_name', 'last_name'] });
    for (const t of rows) teachers.set(t.id, { id: t.id, name: teacherName(t) });
  }

  const activeRoomIds = new Set(rooms.filter((r) => r.is_active).map((r) => r.id));

  return {
    days: project.days || [1, 2, 3, 4, 5],
    periods: project.periods_per_day || 8,
    lunch_after: project.lunch_after || null,
    time_limit: timeLimit || settings.time_limit,
    max_subject_daily: settings.max_culture_daily,
    max_culture_daily: settings.max_culture_daily,
    max_vocational_daily: settings.max_vocational_daily,
    weights: settings.weights,
    block_across_lunch: Boolean(settings.block_across_lunch),
    class_lunch: settings.class_lunch || {},
    classrooms: [...classrooms.values()],
    teachers: [...teachers.values()],
    subjects: [...subjects.values()],
    rooms: rooms.filter((r) => r.is_active).map((r) => ({ id: r.id, name: r.name, capacity: r.capacity || 1 })),
    assignments: assignments.map((a) => ({
      id: a.id,
      classroom_id: a.classroom_id,
      subject_id: a.subject_id,
      teacher_id: a.teacher_id,
      teacher_ids: assignmentTeacherIds(a).filter((id) => id !== a.teacher_id),
      hours: a.weekly_hours,
      blocks: parseBlockPattern(a.block_pattern),
      vocational: a.Subject?.course_kind === 'meslek',
      allow_split: a.allow_split ?? Boolean(a.Subject?.allow_split),
      allow_merge: a.allow_merge ?? Boolean(a.Subject?.allow_merge),
      room_id: a.room_id && activeRoomIds.has(a.room_id) ? a.room_id : null,
      sync_group: a.sync_group || null,
      elective_group: a.elective_group || null,
    })),
    elective_profiles: electiveProfiles(assignments, choices),
    constraints: constraints
      .filter((c) => c.is_active)
      .map((c) => ({ id: c.id, type: c.type, hard: c.is_hard, weight: c.weight, params: c.params })),
    availability: availability.map((row) => ({
      type: row.entity_type,
      id: row.entity_id,
      ...cellsToLists(row.cells),
    })),
    locked: lessons
      .filter((l) => l.is_locked)
      .map((l) => ({ assignment_id: l.assignment_id, day: l.day_of_week, period: l.period_no })),
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  AVAILABILITY_TYPES,
  CELL_STATES,
  assignmentTeacherIds,
  projectSettings,
  parseBlockPattern,
  classroomLabel,
  teacherName,
  loadProjectData,
  buildPayload,
};
