'use strict';

const { DisciplineBehaviorPoint, Student, Classroom } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number'],
  include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
  required: false,
};

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);
      if (req.query.academic_year) where.academic_year = req.query.academic_year;

      const rows = await DisciplineBehaviorPoint.findAll({
        where,
        include: [studentInclude],
        order: [['id', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async summary(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.academic_year) where.academic_year = req.query.academic_year;

      const rows = await DisciplineBehaviorPoint.findAll({ where, include: [studentInclude] });
      const byStudent = new Map();
      rows.forEach((r) => {
        if (!r.Student) return;
        const key = r.student_id;
        if (!byStudent.has(key)) {
          byStudent.set(key, { student: r.Student, points_deducted: 0, points_restored: 0, entries: [] });
        }
        const acc = byStudent.get(key);
        acc.points_deducted += r.points_deducted;
        acc.points_restored += r.points_restored;
        acc.entries.push(r);
      });
      res.json({ success: true, data: [...byStudent.values()] });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      const row = await DisciplineBehaviorPoint.create(payload);
      const full = await DisciplineBehaviorPoint.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, { action: 'create', entityType: 'discipline_behavior_point', entityId: row.id, summary: `Davranış puanı kaydı eklendi (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await DisciplineBehaviorPoint.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineBehaviorPoint.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, { action: 'update', entityType: 'discipline_behavior_point', entityId: row.id, summary: `Davranış puanı güncellendi (#${row.id})` });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await DisciplineBehaviorPoint.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
