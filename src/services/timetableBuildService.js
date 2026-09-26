'use strict';

const {
  TimetableAssignment,
  TimetableConstraint,
  TimetableRoom,
  TimetableLesson,
  Classroom,
  Subject,
  Teacher,
} = require('../models');

const DEFAULT_SETTINGS = {
  time_limit: 60,
  max_subject_daily: 2,
  weights: {
    teacher_gaps: 10,
    class_compact: 60,
    teacher_single_hour_day: 6,
    hard_subject_late: 3,
    soft_constraint: 20,
  },
};

function projectSettings(project) {
  const s = project.settings || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
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

/** Projenin atama/mekan/öğretmen/şube/ders kayıtlarını tek seferde yükler. */
async function loadProjectData(project) {
  const [assignments, constraints, rooms, lessons] = await Promise.all([
    TimetableAssignment.findAll({
      where: { project_id: project.id },
      include: [
        { model: Classroom, attributes: ['id', 'class_level', 'section'] },
        { model: Subject, attributes: ['id', 'name', 'difficulty_level'] },
        { model: Teacher, as: 'Teacher', attributes: ['id', 'first_name', 'last_name', 'brans'] },
      ],
      order: [['id', 'ASC']],
    }),
    TimetableConstraint.findAll({ where: { project_id: project.id }, order: [['id', 'ASC']] }),
    TimetableRoom.findAll({ where: { tenant_id: project.tenant_id, school_id: project.school_id }, order: [['name', 'ASC']] }),
    TimetableLesson.findAll({ where: { project_id: project.id } }),
  ]);
  return { assignments, constraints, rooms, lessons };
}

/** Çözücüye gönderilecek JSON'u üretir (solver/timetable_model.py girdisi). */
async function buildPayload(project, { timeLimit } = {}) {
  const settings = projectSettings(project);
  const { assignments, constraints, rooms, lessons } = await loadProjectData(project);

  const classrooms = new Map();
  const teachers = new Map();
  const subjects = new Map();
  for (const a of assignments) {
    if (a.Classroom) classrooms.set(a.classroom_id, { id: a.classroom_id, label: classroomLabel(a.Classroom) });
    if (a.Teacher) teachers.set(a.teacher_id, { id: a.teacher_id, name: teacherName(a.Teacher) });
    if (a.Subject) {
      subjects.set(a.subject_id, {
        id: a.subject_id,
        name: a.Subject.name,
        hard: a.Subject.difficulty_level === 'zor',
      });
    }
  }

  const activeRoomIds = new Set(rooms.filter((r) => r.is_active).map((r) => r.id));

  return {
    days: project.days || [1, 2, 3, 4, 5],
    periods: project.periods_per_day || 8,
    lunch_after: project.lunch_after || null,
    time_limit: timeLimit || settings.time_limit,
    max_subject_daily: settings.max_subject_daily,
    weights: settings.weights,
    classrooms: [...classrooms.values()],
    teachers: [...teachers.values()],
    subjects: [...subjects.values()],
    rooms: rooms.filter((r) => r.is_active).map((r) => ({ id: r.id, name: r.name, capacity: r.capacity || 1 })),
    assignments: assignments.map((a) => ({
      id: a.id,
      classroom_id: a.classroom_id,
      subject_id: a.subject_id,
      teacher_id: a.teacher_id,
      hours: a.weekly_hours,
      blocks: parseBlockPattern(a.block_pattern),
      room_id: a.room_id && activeRoomIds.has(a.room_id) ? a.room_id : null,
      sync_group: a.sync_group || null,
    })),
    constraints: constraints
      .filter((c) => c.is_active)
      .map((c) => ({ id: c.id, type: c.type, hard: c.is_hard, weight: c.weight, params: c.params })),
    locked: lessons
      .filter((l) => l.is_locked)
      .map((l) => ({ assignment_id: l.assignment_id, day: l.day_of_week, period: l.period_no })),
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  projectSettings,
  parseBlockPattern,
  classroomLabel,
  teacherName,
  loadProjectData,
  buildPayload,
};
