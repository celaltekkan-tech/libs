'use strict';

const { teacherName } = require('./timetableBuildService');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sectionSort(a, b) {
  const level = String(a.class_level).localeCompare(String(b.class_level), 'tr', { numeric: true });
  if (level) return level;
  return String(a.section).localeCompare(String(b.section), 'tr', { sensitivity: 'base' });
}

/**
 * Taslak dersleri, e-Okul "Ders Programı" ızgarasının dolduracağı biçime çevirir.
 * Aynı şube/gün/saatte birden fazla ders varsa (seçmeli) hepsi subjects içinde durur.
 */
function buildEokulPayload(project, lessons) {
  const classes = new Map();

  for (const lesson of lessons) {
    const assignment = lesson.Assignment;
    const classroom = assignment?.Classroom;
    const subject = assignment?.Subject;
    if (!classroom || !subject?.name) continue;

    if (!classes.has(assignment.classroom_id)) {
      classes.set(assignment.classroom_id, {
        class_level: String(classroom.class_level),
        section: String(classroom.section),
        label: `${classroom.class_level}/${classroom.section}`,
        slots: new Map(),
      });
    }

    const bucket = classes.get(assignment.classroom_id);
    const slotKey = `${lesson.day_of_week}-${lesson.period_no}`;
    if (!bucket.slots.has(slotKey)) {
      bucket.slots.set(slotKey, {
        day: lesson.day_of_week,
        period: lesson.period_no,
        subjects: [],
      });
    }

    const slot = bucket.slots.get(slotKey);
    if (slot.subjects.some((item) => item.name === subject.name)) continue;
    slot.subjects.push({
      name: subject.name,
      code: subject.code || null,
      teacher: teacherName(assignment.Teacher),
    });
  }

  const list = [...classes.values()].map((item) => ({
    class_level: item.class_level,
    section: item.section,
    label: item.label,
    slots: [...item.slots.values()].sort((a, b) => a.day - b.day || a.period - b.period),
  }));
  list.sort(sectionSort);

  if (!list.length) throw httpError(400, 'Bu çalışmada yerleşmiş ders yok');

  return {
    version: 1,
    source: 'oids',
    project: {
      id: project.id,
      name: project.name,
      academic_year: project.academic_year || null,
    },
    classes: list,
  };
}

module.exports = { buildEokulPayload };
