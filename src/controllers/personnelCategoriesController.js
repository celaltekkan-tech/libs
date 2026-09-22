'use strict';

const { PersonnelCategory, Teacher } = require('../models');
const audit = require('../services/auditService');

const DEFAULT_CATEGORIES = [
  { name: 'Memur', code: 'memur', sort_order: 10 },
  { name: 'İşçi', code: 'isci', sort_order: 20 },
  { name: 'TYP Personeli', code: 'typ', sort_order: 30 },
];

async function ensureDefaultCategories(tenantId) {
  const existing = await PersonnelCategory.findAll({ where: { tenant_id: tenantId } });
  if (existing.length > 0) return existing;

  const created = await PersonnelCategory.bulkCreate(
    DEFAULT_CATEGORIES.map((row) => ({ ...row, tenant_id: tenantId }))
  );

  for (const cat of created) {
    if (!cat.code) continue;
    await Teacher.update(
      { personnel_category_id: cat.id },
      { where: { tenant_id: tenantId, personnel_type: cat.code, personnel_category_id: null } }
    );
  }
  return created;
}

function assertTenant(req, row) {
  return !(req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id);
}

module.exports = {
  ensureDefaultCategories,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) await ensureDefaultCategories(tenantId);
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      const rows = await PersonnelCategory.findAll({
        where,
        order: [
          ['sort_order', 'ASC'],
          ['name', 'ASC'],
        ],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const body = req.validatedBody || req.body;
      const maxOrder = await PersonnelCategory.max('sort_order', {
        where: tenantId ? { tenant_id: tenantId } : {},
      });
      const row = await PersonnelCategory.create({
        tenant_id: tenantId,
        name: String(body.name).trim(),
        code: null,
        sort_order: body.sort_order != null ? Number(body.sort_order) : (maxOrder || 0) + 10,
      });
      await audit.log(req, {
        action: 'create',
        entityType: 'personnel_category',
        entityId: row.id,
        summary: `Personel kategorisi eklendi: ${row.name}`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Bu isimde bir kategori zaten var',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await PersonnelCategory.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenant(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const body = req.validatedBody || req.body;
      if (body.name != null) row.name = String(body.name).trim();
      if (body.sort_order != null) row.sort_order = Number(body.sort_order);
      await row.save();
      await audit.log(req, {
        action: 'update',
        entityType: 'personnel_category',
        entityId: row.id,
        summary: `Personel kategorisi güncellendi: ${row.name}`,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Bu isimde bir kategori zaten var',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await PersonnelCategory.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenant(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const inUse = await Teacher.count({ where: { personnel_category_id: row.id } });
      if (inUse > 0) {
        return res.status(400).json({
          success: false,
          message: `Bu kategoride ${inUse} personel var. Önce personelleri başka kategoriye taşıyın.`,
        });
      }
      const name = row.name;
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'personnel_category',
        entityId: id,
        summary: `Personel kategorisi silindi: ${name}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
