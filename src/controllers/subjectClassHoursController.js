'use strict';

const { SubjectClassHour, Subject } = require('../models');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.subject_id) where.subject_id = Number(req.query.subject_id);

      const rows = await SubjectClassHour.findAll({ where, order: [['class_level', 'ASC']] });
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

      const subject = await Subject.findByPk(payload.subject_id);
      if (!subject || (tenantId && subject.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen ders bulunamadı' });
      }

      const row = await SubjectClassHour.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_CLASS_HOUR',
          message: 'Bu ders için bu sınıf seviyesinde saat zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await SubjectClassHour.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await SubjectClassHour.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
