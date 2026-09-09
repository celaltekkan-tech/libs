'use strict';

const { Holiday } = require('../models');
const { seedDefaultHolidays } = require('../services/holidayService');

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
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const row = await Holiday.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
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
      const rows = await Holiday.findAll({ where: { tenant_id: tenantId }, order: [['month', 'ASC'], ['day', 'ASC']] });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },
};
