'use strict';

const { Holiday } = require('../models');
const { seedDefaultHolidays, createHolidays } = require('../services/holidayService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const rows = await Holiday.findAll({
        where: { tenant_id: tenantId },
        order: [
          ['year', 'ASC'],
          ['month', 'ASC'],
          ['day', 'ASC'],
        ],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = (req.user && req.user.tenant_id) || payload.tenant_id;
      const result = await createHolidays(tenantId, payload);

      if (result.created.length === 0 && result.skipped > 0) {
        return res.status(409).json({
          success: false,
          message: result.total === 1
            ? 'Bu tarih için zaten bir resmi tatil tanımlı'
            : 'Seçilen aralıktaki günlerin tümü zaten tanımlı',
        });
      }

      const data = result.total === 1 ? result.created[0] : result.created;
      res.status(201).json({
        success: true,
        data,
        meta: { created: result.created.length, skipped: result.skipped, total: result.total },
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, message: 'Bu tarih için zaten bir resmi tatil tanımlı' });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await Holiday.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // Varsayılan sabit tarihli resmi tatilleri (Yılbaşı, 23 Nisan vb.) bu
  // tenant için tanımlar; zaten tanımlı olanlar yinelenmez.
  async seedDefaults(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      await seedDefaultHolidays(tenantId);
      const rows = await Holiday.findAll({
        where: { tenant_id: tenantId },
        order: [
          ['year', 'ASC'],
          ['month', 'ASC'],
          ['day', 'ASC'],
        ],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },
};
