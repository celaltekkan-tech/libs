'use strict';

// Ders havuzundaki ortak dersleri (seçmeli olmayan; rehberlik dahil) şubelere
// otomatik verir. Kullanıcının kaldırdığı (şube, ders) çiftleri proje ayarında
// `common_excluded` altında tutulur ve bir daha eklenmez.

const { Op } = require('sequelize');
const { sequelize, Classroom, Subject, SubjectClassHour, TimetableAssignment, TimetableProject } = require('../models');

function excludedMap(project) {
  const raw = (project.settings && project.settings.common_excluded) || {};
  const out = {};
  for (const [cid, list] of Object.entries(raw)) {
    const ids = [...new Set((Array.isArray(list) ? list : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length) out[cid] = ids;
  }
  return out;
}

async function saveExcluded(project, map, transaction) {
  // Eşzamanlı güncellemelerde diğer ayarlar ezilmesin diye güncel satır okunur.
  const fresh = await TimetableProject.findByPk(project.id, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  const settings = { ...(fresh.settings || {}), common_excluded: map };
  await fresh.update({ settings }, { transaction });
  project.settings = settings;
}

async function projectClassrooms(project, classroomIds, transaction) {
  const where = { tenant_id: project.tenant_id, school_id: project.school_id, is_active: true };
  if (project.academic_year) {
    where[Op.or] = [{ academic_year: project.academic_year }, { academic_year: null }, { academic_year: '' }];
  }
  if (classroomIds && classroomIds.length) where.id = classroomIds;
  return Classroom.findAll({ where, order: [['class_level', 'ASC'], ['section', 'ASC']], transaction });
}

/**
 * Eksik ortak dersleri ekler. Dönüş:
 * { created, classrooms, needs_choice: [{classroom_id, subject_id, subject_name, options}], excluded }
 * Bir seviyede birden fazla saat seçeneği olan ortak ders tahminle eklenmez; needs_choice'ta döner.
 */
async function syncCommonLessons(project, { classroomIds } = {}) {
  // Aynı projede eşzamanlı eşitleme (iki sekme vb.) çift kayıt üretmesin.
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:key)', {
      replacements: { key: 7300000000 + project.id },
      transaction,
    });
    const fresh = await TimetableProject.findByPk(project.id, { transaction });
    return syncLocked(fresh || project, { classroomIds, transaction });
  });
}

async function syncLocked(project, { classroomIds, transaction }) {
  const [classrooms, subjects] = await Promise.all([
    projectClassrooms(project, classroomIds, transaction),
    Subject.findAll({
      where: { tenant_id: project.tenant_id, is_active: true, is_elective: false },
      attributes: ['id', 'name'],
      transaction,
    }),
  ]);
  const excluded = excludedMap(project);
  if (!classrooms.length || !subjects.length) {
    return { created: 0, classrooms: 0, needs_choice: [], excluded };
  }
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const levels = [...new Set(classrooms.map((c) => c.class_level))];
  const [hours, existing] = await Promise.all([
    SubjectClassHour.findAll({
      where: { tenant_id: project.tenant_id, subject_id: subjects.map((s) => s.id), class_level: levels },
      transaction,
    }),
    TimetableAssignment.findAll({
      where: { project_id: project.id, classroom_id: classrooms.map((c) => c.id) },
      attributes: ['classroom_id', 'subject_id'],
      transaction,
    }),
  ]);
  const options = new Map();
  for (const h of hours) {
    if (!h.weekly_hours) continue;
    const key = `${h.class_level}:${h.subject_id}`;
    options.set(key, [...(options.get(key) || []), h]);
  }
  const have = new Set(existing.map((a) => `${a.classroom_id}:${a.subject_id}`));

  const rows = [];
  const needsChoice = [];
  const touched = new Set();
  for (const c of classrooms) {
    const skip = new Set(excluded[String(c.id)] || []);
    for (const [key, list] of options.entries()) {
      const [level, sid] = key.split(':');
      if (level !== c.class_level) continue;
      const subjectId = Number(sid);
      if (skip.has(subjectId) || have.has(`${c.id}:${subjectId}`)) continue;
      const uniq = [...new Map(list.map((h) => [h.weekly_hours, h])).values()].sort((a, b) => a.weekly_hours - b.weekly_hours);
      if (uniq.length > 1) {
        needsChoice.push({
          classroom_id: c.id,
          subject_id: subjectId,
          subject_name: subjectById.get(subjectId)?.name || '',
          options: uniq.map((h) => h.weekly_hours),
        });
        continue;
      }
      rows.push({
        tenant_id: project.tenant_id,
        project_id: project.id,
        classroom_id: c.id,
        subject_id: subjectId,
        weekly_hours: uniq[0].weekly_hours,
        block_pattern: uniq[0].block_pattern || null,
        source: 'pool',
      });
      touched.add(c.id);
    }
  }
  if (rows.length) await TimetableAssignment.bulkCreate(rows, { transaction });
  return { created: rows.length, classrooms: touched.size, needs_choice: needsChoice, excluded };
}

/** Silinen ortak dersi şube için hariç tutar (yalnız havuzda saati olan seçmeli olmayan dersler). */
async function excludeOnDelete(assignment) {
  const [project, subject, classroom] = await Promise.all([
    TimetableProject.findByPk(assignment.project_id),
    Subject.findByPk(assignment.subject_id, { attributes: ['id', 'is_elective'] }),
    Classroom.findByPk(assignment.classroom_id, { attributes: ['id', 'class_level'] }),
  ]);
  if (!project || !subject || subject.is_elective || !classroom) return false;
  const inPool = await SubjectClassHour.count({
    where: { tenant_id: project.tenant_id, subject_id: subject.id, class_level: classroom.class_level },
  });
  if (!inPool && assignment.source !== 'pool') return false;
  await sequelize.transaction(async (transaction) => {
    const map = excludedMap(project);
    const key = String(classroom.id);
    map[key] = [...new Set([...(map[key] || []), subject.id])];
    await saveExcluded(project, map, transaction);
  });
  return true;
}

/** Şubenin (ya da verilen derslerin) hariç tutulmasını kaldırır ve eşitler. */
async function restoreCommon(project, classroomId, subjectIds) {
  await sequelize.transaction(async (transaction) => {
    const map = excludedMap(project);
    const key = String(classroomId);
    if (subjectIds && subjectIds.length) {
      map[key] = (map[key] || []).filter((id) => !subjectIds.includes(id));
      if (!map[key].length) delete map[key];
    } else {
      delete map[key];
    }
    await saveExcluded(project, map, transaction);
  });
  return syncCommonLessons(project, { classroomIds: [classroomId] });
}

module.exports = { syncCommonLessons, excludeOnDelete, restoreCommon, excludedMap };
