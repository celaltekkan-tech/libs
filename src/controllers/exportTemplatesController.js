'use strict';

const { ExportTemplate } = require('../models');

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
      if (req.query.entity_type) where.entity_type = req.query.entity_type;

      const rows = await ExportTemplate.findAll({ where, order: [['name', 'ASC']], limit: 200 });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (req.user && req.user.user_id) payload.user_id = req.user.user_id;

      const row = await ExportTemplate.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_TEMPLATE_NAME',
          message: 'Bu isimde bir şablon zaten var',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await ExportTemplate.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
