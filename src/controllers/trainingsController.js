'use strict';

const { TrainingRecord, Teacher } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const teacherInclude = {
  model: Teacher,
  attributes: ['id', 'first_name', 'last_name', 'personnel_no'],
  required: false,
};

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);

      const rows = await TrainingRecord.findAll({
        where,
        include: [teacherInclude],
        order: [['start_date', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await TrainingRecord.findByPk(req.params.id, { include: [teacherInclude] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      const teacher = await Teacher.findByPk(payload.teacher_id);
      if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen personel bulunamadı' });
      }

      const row = await TrainingRecord.create(payload);
      const full = await TrainingRecord.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'training_record',
        entityId: row.id,
        summary: `Hizmet içi eğitim kaydı eklendi: ${teacher.first_name} ${teacher.last_name} - ${row.title}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await TrainingRecord.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen personel bulunamadı' });
        }
      }

      await row.update(payload);
      const full = await TrainingRecord.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'training_record',
        entityId: row.id,
        summary: `Hizmet içi eğitim kaydı güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await TrainingRecord.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'training_record',
        entityId: id,
        summary: `Hizmet içi eğitim kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
