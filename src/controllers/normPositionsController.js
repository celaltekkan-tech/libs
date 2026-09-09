'use strict';

const { NormPosition, Teacher, School } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const schoolInclude = {
  model: School,
  attributes: ['id', 'name', 'code'],
  required: false,
};

async function withOccupancy(tenantId, row) {
  const where = { tenant_id: tenantId, title_branch: row.title_branch };
  if (row.school_id) where.school_id = row.school_id;
  const filled = await Teacher.count({ where });
  const vacant = Math.max(row.quota_count - filled, 0);
  return {
    ...row.toJSON(),
    filled_count: filled,
    vacant_count: vacant,
    occupancy_rate: row.quota_count > 0 ? Math.round((filled / row.quota_count) * 100) : null,
  };
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.school_id) where.school_id = Number(req.query.school_id);

      const rows = await NormPosition.findAll({
        where,
        include: [schoolInclude],
        order: [['title_branch', 'ASC']],
        limit: 1000,
      });
      const data = await Promise.all(rows.map((row) => withOccupancy(tenantId, row)));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await NormPosition.findByPk(req.params.id, { include: [schoolInclude] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const data = await withOccupancy(req.user && req.user.tenant_id, row);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.notes === '') payload.notes = null;

      const row = await NormPosition.create(payload);
      const full = await NormPosition.findByPk(row.id, { include: [schoolInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'norm_position',
        entityId: row.id,
        summary: `Norm kadro tanımlandı: ${row.title_branch} (${row.quota_count})`,
      });
      res.status(201).json({ success: true, data: await withOccupancy(payload.tenant_id, full) });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_NORM_POSITION',
          message: 'Bu okul ve unvan/branş için norm kadro zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await NormPosition.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.notes === '') payload.notes = null;

      await row.update(payload);
      const full = await NormPosition.findByPk(row.id, { include: [schoolInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'norm_position',
        entityId: row.id,
        summary: `Norm kadro güncellendi: ${row.title_branch}`,
      });
      res.json({ success: true, data: await withOccupancy(req.user && req.user.tenant_id, full) });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_NORM_POSITION',
          message: 'Bu okul ve unvan/branş için norm kadro zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await NormPosition.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const label = row.title_branch;
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'norm_position',
        entityId: id,
        summary: `Norm kadro silindi: ${label}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
