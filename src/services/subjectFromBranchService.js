'use strict';

const { Subject, Teacher } = require('../models');
const { splitUnvanBrans } = require('../utils/teacherTitle');

const MAX_NAME_LENGTH = 100;
const SKIP_BRANCH_KEYS = new Set(['rehber', 'müdür', 'müdür yardımcısı', 'öğretmen', 'memur']);

function normalizeSubjectName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function subjectNameKey(value) {
  return normalizeSubjectName(value).toLocaleLowerCase('tr-TR');
}

function isSkippedBranch(name) {
  return SKIP_BRANCH_KEYS.has(subjectNameKey(name));
}

function branchFromTitle(titleBranch) {
  const split = splitUnvanBrans(titleBranch);
  if (split.brans) return normalizeSubjectName(split.brans);
  const raw = normalizeSubjectName(split.unvan || titleBranch);
  if (!raw) return null;
  const lower = raw.toLocaleLowerCase('tr-TR');
  if (lower.endsWith(' öğretmeni')) return raw.slice(0, -' öğretmeni'.length).trim();
  if (lower.endsWith(' öğretmen')) return raw.slice(0, -' öğretmen'.length).trim();
  return null;
}

function isTeacherForSubject(row) {
  const type = String(row?.personnel_type || 'ogretmen');
  if (type !== 'ogretmen') return false;
  if (row?.personnel_category_id) return false;
  return true;
}

function branchFromTeacher(row) {
  if (!isTeacherForSubject(row)) return null;
  let name = normalizeSubjectName(row?.brans);
  if (!name) name = branchFromTitle(row?.title_branch);
  if (!name || name.length > MAX_NAME_LENGTH || isSkippedBranch(name)) return null;
  return name;
}

async function ensureSubjectsForBranches(tenantId, branchNames, { transaction } = {}) {
  if (!tenantId) return [];
  const wanted = [];
  const seen = new Set();
  for (const raw of branchNames || []) {
    const name = normalizeSubjectName(raw);
    if (!name || name.length > MAX_NAME_LENGTH) continue;
    const key = subjectNameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push(name);
  }
  if (wanted.length === 0) return [];

  const existing = await Subject.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id', 'name'],
    transaction,
  });
  const existingKeys = new Set(existing.map((row) => subjectNameKey(row.name)));
  const created = [];

  for (const name of wanted) {
    const key = subjectNameKey(name);
    if (existingKeys.has(key)) continue;
    try {
      const row = await Subject.create(
        { tenant_id: tenantId, name, is_active: true },
        { transaction },
      );
      existingKeys.add(key);
      created.push(row);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        existingKeys.add(key);
        continue;
      }
      throw err;
    }
  }

  return created;
}

async function ensureSubjectFromTeacher(teacher, { transaction } = {}) {
  const name = branchFromTeacher(teacher);
  if (!name || !teacher?.tenant_id) return [];
  return ensureSubjectsForBranches(teacher.tenant_id, [name], { transaction });
}

async function backfillSubjectsFromTeachers({ tenantId } = {}) {
  const where = {
    personnel_type: 'ogretmen',
    personnel_category_id: null,
  };
  if (tenantId) where.tenant_id = tenantId;

  const teachers = await Teacher.findAll({
    where,
    attributes: ['tenant_id', 'brans', 'title_branch'],
  });

  const byTenant = new Map();
  for (const teacher of teachers) {
    const name = branchFromTeacher(teacher);
    if (!name) continue;
    const list = byTenant.get(teacher.tenant_id) || [];
    list.push(name);
    byTenant.set(teacher.tenant_id, list);
  }

  let createdCount = 0;
  for (const [id, names] of byTenant.entries()) {
    const created = await ensureSubjectsForBranches(id, names);
    createdCount += created.length;
  }
  return { tenantCount: byTenant.size, createdCount };
}

module.exports = {
  normalizeSubjectName,
  branchFromTeacher,
  ensureSubjectsForBranches,
  ensureSubjectFromTeacher,
  backfillSubjectsFromTeachers,
};
