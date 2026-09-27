'use strict';

const { Op } = require('sequelize');
const { Branch, Subject, Teacher } = require('../models');
const { branchFromTeacher, normalizeSubjectName } = require('./subjectFromBranchService');

/** Branş adlarını karşılaştırmak için anahtar (Türkçe küçük harf, tek boşluk). */
function branchKey(name) {
  return normalizeSubjectName(name).toLocaleLowerCase('tr-TR');
}

/** Öğretmenin branş anahtarı; brans alanı boşsa unvan-branş metninden çıkarılır. */
function teacherBranchKey(teacher) {
  const name = branchFromTeacher(teacher);
  return name ? branchKey(name) : '';
}

/**
 * Öğretmenlerde geçen branşları Branches tablosuna ekler ve branşı boş olan
 * aynı adlı dersleri o branşa bağlar. Liste her açıldığında çağrılır; idempotent.
 */
async function syncBranches(tenantId) {
  if (!tenantId) return;
  const [teachers, existing] = await Promise.all([
    Teacher.findAll({
      where: { tenant_id: tenantId, personnel_type: 'ogretmen', personnel_category_id: null },
      attributes: ['tenant_id', 'brans', 'title_branch', 'personnel_type', 'personnel_category_id'],
    }),
    Branch.findAll({ where: { tenant_id: tenantId }, attributes: ['id', 'name'] }),
  ]);
  const keys = new Map(existing.map((b) => [branchKey(b.name), b.id]));
  for (const t of teachers) {
    const name = branchFromTeacher(t);
    if (!name) continue;
    const key = branchKey(name);
    if (keys.has(key)) continue;
    try {
      const row = await Branch.create({ tenant_id: tenantId, name });
      keys.set(key, row.id);
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }

  const unlinked = await Subject.findAll({
    where: { tenant_id: tenantId, branch_id: null },
    attributes: ['id', 'name'],
  });
  for (const s of unlinked) {
    const id = keys.get(branchKey(s.name));
    if (id) await Subject.update({ branch_id: id }, { where: { id: s.id } });
  }
}

async function listBranches(tenantId) {
  const where = tenantId ? { tenant_id: tenantId } : {};
  return Branch.findAll({ where, order: [['name', 'ASC']] });
}

/** Aynı adda başka branş var mı (kendisi hariç). */
async function nameTaken(tenantId, name, exceptId) {
  const rows = await Branch.findAll({
    where: { tenant_id: tenantId, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) },
    attributes: ['name'],
  });
  const key = branchKey(name);
  return rows.some((b) => branchKey(b.name) === key);
}

module.exports = { branchKey, teacherBranchKey, syncBranches, listBranches, nameTaken };
