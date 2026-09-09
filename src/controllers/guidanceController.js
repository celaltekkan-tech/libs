'use strict';

const { GuidanceSession, Student, Classroom } = require('../models');
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
  // Bu modül gizlilik dereceli olduğu için yalnızca Rehber Öğretmen ve Müdür
  // rollerine izin verilir (bkz. seed-guidance-permissions).
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);

      const rows = await GuidanceSession.findAll({
        where,
        include: [studentInclude],
        order: [['session_date', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      if (req.user && req.user.user_id) payload.created_by = req.user.user_id;

      const student = await Student.findByPk(payload.student_id);
      if (!student || (tenantId && student.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğrenci bulunamadı' });
      }

      const row = await GuidanceSession.create(payload);
      const full = await GuidanceSession.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'guidance_session',
        entityId: row.id,
        summary: `Rehberlik görüşme kaydı eklendi: ${student.first_name} ${student.last_name}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await GuidanceSession.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await GuidanceSession.findByPk(row.id, { include: [studentInclude] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await GuidanceSession.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'guidance_session',
        entityId: id,
        summary: `Rehberlik görüşme kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async stats(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const rows = await GuidanceSession.findAll({ where: { tenant_id: tenantId } });
      const byType = {};
      const byReferral = {};
      rows.forEach((r) => {
        byType[r.session_type] = (byType[r.session_type] || 0) + 1;
        if (r.referral_to) byReferral[r.referral_to] = (byReferral[r.referral_to] || 0) + 1;
      });
      res.json({ success: true, data: { total: rows.length, by_type: byType, by_referral: byReferral } });
    } catch (err) {
      next(err);
    }
  },
};
