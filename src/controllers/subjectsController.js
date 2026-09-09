'use strict';

const { Subject } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const COLUMN_LABELS = {
  name: 'Ders',
  code: 'Kod',
  is_active: 'Durum',
};

const DEFAULT_COLUMNS = ['name', 'code', 'is_active'];

function matchesSearch(row, q) {
  const needle = String(q || '').trim().toLocaleLowerCase('tr-TR');
  if (!needle) return true;
  return (
    String(row.name || '').toLocaleLowerCase('tr-TR').includes(needle) ||
    String(row.code || '').toLocaleLowerCase('tr-TR').includes(needle)
  );
}

function formatCell(row, key) {
  if (key === 'is_active') return row.is_active ? 'Aktif' : 'Pasif';
  const value = row[key];
  if (value == null || value === '') return '';
  return String(value);
}

module.exports = {
  COLUMN_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.is_active === 'true') where.is_active = true;
      if (req.query.is_active === 'false') where.is_active = false;

      const subjects = await Subject.findAll({ where, order: [['name', 'ASC']], limit: 1000 });
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const subject = await Subject.findByPk(req.params.id);
      if (!subject) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, subject)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: subject });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.code === '') payload.code = null;
      if (payload.is_active == null) payload.is_active = true;

      const subject = await Subject.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'subject',
        entityId: subject.id,
        summary: `Ders tanımlandı: ${subject.name}`,
      });
      res.status(201).json({ success: true, data: subject });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_SUBJECT',
          message: 'Bu isimde bir ders zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const subject = await Subject.findByPk(req.params.id);
      if (!subject) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, subject)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.code === '') payload.code = null;

      await subject.update(payload);
      await audit.log(req, {
        action: 'update',
        entityType: 'subject',
        entityId: subject.id,
        summary: `Ders güncellendi: ${subject.name}`,
      });
      res.json({ success: true, data: subject });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_SUBJECT',
          message: 'Bu isimde bir ders zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const subject = await Subject.findByPk(req.params.id);
      if (!subject) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, subject)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const name = subject.name;
      const id = subject.id;
      try {
        await subject.destroy();
      } catch (destroyErr) {
        if (destroyErr.name === 'SequelizeForeignKeyConstraintError') {
          return res.status(409).json({
            success: false,
            code: 'SUBJECT_IN_USE',
            message: 'Bu ders ders programında kullanılıyor. Önce ilgili kayıtları kaldırın.',
          });
        }
        throw destroyErr;
      }
      await audit.log(req, {
        action: 'delete',
        entityType: 'subject',
        entityId: id,
        summary: `Ders silindi: ${name}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, columns, filters } = req.validatedBody || req.body;
      const requested = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
      const allowed = requested.filter((c) => COLUMN_LABELS[c]);
      if (allowed.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli sütun seçilmedi' });
      }

      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (typeof filters?.is_active === 'boolean') where.is_active = filters.is_active;

      let subjects = await Subject.findAll({ where, order: [['name', 'ASC']], limit: 5000 });
      if (filters?.q) {
        subjects = subjects.filter((row) => matchesSearch(row, filters.q));
      }

      await sendTableExport(res, {
        format,
        filename: 'dersler',
        title: 'Ders Listesi',
        headers: allowed.map((key) => COLUMN_LABELS[key]),
        rows: subjects.map((row) => allowed.map((key) => formatCell(row, key))),
      });
    } catch (err) {
      next(err);
    }
  },
};
