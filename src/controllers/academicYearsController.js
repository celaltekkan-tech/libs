'use strict';

const { Op } = require('sequelize');
const { AcademicYear, ExamPeriod, sequelize } = require('../models');
const audit = require('../services/auditService');
const { calendarDate } = require('../utils/calendarDate');

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
      const rows = await AcademicYear.findAll({ where, order: [['label', 'DESC']], limit: 200 });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async current(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const row = await AcademicYear.findOne({ where: { tenant_id: tenantId, is_current: true } });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      const row = await sequelize.transaction(async (t) => {
        if (payload.is_current) {
          await AcademicYear.update(
            { is_current: false },
            { where: { tenant_id: payload.tenant_id, is_current: true }, transaction: t }
          );
        }
        return AcademicYear.create(payload, { transaction: t });
      });

      await audit.log(req, {
        action: 'create',
        entityType: 'academic_year',
        entityId: row.id,
        summary: `Eğitim öğretim yılı tanımlandı: ${row.label}`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ACADEMIC_YEAR',
          message: 'Bu eğitim öğretim yılı zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await AcademicYear.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      if (payload.start_date !== undefined || payload.end_date !== undefined) {
        const nextStart =
          payload.start_date != null ? calendarDate(payload.start_date) : calendarDate(row.start_date);
        const nextEnd = payload.end_date != null ? calendarDate(payload.end_date) : calendarDate(row.end_date);
        if (!nextStart || !nextEnd) {
          const placed = await ExamPeriod.count({ where: { academic_year_id: row.id } });
          if (placed > 0) {
            return res.status(400).json({
              success: false,
              message: 'Sınav tarihi varken eğitim öğretim yılı aralığı boş bırakılamaz.',
            });
          }
        } else if (nextEnd < nextStart) {
          return res.status(400).json({ success: false, message: 'Bitiş tarihi başlangıçtan önce olamaz.' });
        } else {
          const outside = await ExamPeriod.findOne({
            where: {
              academic_year_id: row.id,
              [Op.or]: [{ start_date: { [Op.lt]: nextStart } }, { end_date: { [Op.gt]: nextEnd } }],
            },
          });
          if (outside) {
            return res.status(400).json({
              success: false,
              message: 'Eğitim öğretim yılı aralığı, kayıtlı sınav tarihlerinden birini dışarıda bırakıyor.',
            });
          }
        }
      }

      await sequelize.transaction(async (t) => {
        if (payload.is_current) {
          await AcademicYear.update(
            { is_current: false },
            { where: { tenant_id: row.tenant_id, is_current: true }, transaction: t }
          );
        }
        await row.update(payload, { transaction: t });
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'academic_year',
        entityId: row.id,
        summary: `Eğitim öğretim yılı güncellendi: ${row.label}`,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ACADEMIC_YEAR',
          message: 'Bu eğitim öğretim yılı zaten tanımlı',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await AcademicYear.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const label = row.label;
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'academic_year',
        entityId: id,
        summary: `Eğitim öğretim yılı silindi: ${label}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
