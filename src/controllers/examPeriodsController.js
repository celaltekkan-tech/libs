'use strict';

const { Op } = require('sequelize');
const { AcademicYear, Exam, ExamPeriod, sequelize } = require('../models');
const audit = require('../services/auditService');
const { calendarDate } = require('../utils/calendarDate');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

async function currentYear(tenantId) {
  if (!tenantId) return null;
  return AcademicYear.findOne({ where: { tenant_id: tenantId, is_current: true } });
}

function boundsError(year, start, end) {
  if (!year) return 'Aktif eğitim öğretim yılı yok. Önce yılı tanımlayın.';
  if (!year.start_date || !year.end_date) {
    return 'Aktif eğitim öğretim yılının başlangıç ve bitiş tarihi girilmeli.';
  }
  if (!start || !end) return 'Sınav tarihi aralığı eksik.';
  if (end < start) return 'Bitiş tarihi başlangıçtan önce olamaz.';
  const yearStart = calendarDate(year.start_date);
  const yearEnd = calendarDate(year.end_date);
  if (start < yearStart || end > yearEnd) {
    return `Sınav tarihi ${year.label} yılı içinde olmalı (${yearStart} – ${yearEnd}).`;
  }
  return null;
}

async function findOverlap({ tenantId, yearId, examType, start, end, excludeId }) {
  const where = {
    tenant_id: tenantId,
    academic_year_id: yearId,
    exam_type: examType,
    start_date: { [Op.lte]: end },
    end_date: { [Op.gte]: start },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return ExamPeriod.findOne({ where });
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const examType = req.query.exam_type || 'ortak';
      const year = await currentYear(tenantId);
      if (!year) return res.json({ success: true, data: [] });
      const rows = await ExamPeriod.findAll({
        where: { tenant_id: tenantId, academic_year_id: year.id, exam_type: examType },
        order: [['start_date', 'ASC']],
        limit: 100,
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
      const year = await currentYear(tenantId);
      const start = calendarDate(body.start_date);
      const end = calendarDate(body.end_date);
      const examType = body.exam_type || 'ortak';
      const error = boundsError(year, start, end);
      if (error) return res.status(400).json({ success: false, message: error });

      const overlap = await findOverlap({
        tenantId,
        yearId: year.id,
        examType,
        start,
        end,
      });
      if (overlap) {
        return res.status(409).json({
          success: false,
          message: 'Bu aralık mevcut bir sınav tarihiyle çakışıyor.',
        });
      }

      const label = body.label && String(body.label).trim() ? String(body.label).trim() : null;
      const row = await sequelize.transaction(async (t) => {
        await ExamPeriod.update(
          { is_active: false },
          {
            where: { tenant_id: tenantId, academic_year_id: year.id, exam_type: examType, is_active: true },
            transaction: t,
          }
        );
        return ExamPeriod.create(
          {
            tenant_id: tenantId,
            academic_year_id: year.id,
            exam_type: examType,
            label,
            start_date: start,
            end_date: end,
            is_active: true,
          },
          { transaction: t }
        );
      });

      await audit.log(req, {
        action: 'create',
        entityType: 'exam_period',
        entityId: row.id,
        summary: `Sınav tarihi oluşturuldu: ${start} – ${end}`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await ExamPeriod.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const tenantId = req.user && req.user.tenant_id;
      const body = req.validatedBody || req.body;
      const year = await AcademicYear.findByPk(row.academic_year_id);
      const start = calendarDate(body.start_date || row.start_date);
      const end = calendarDate(body.end_date || row.end_date);
      if (body.start_date || body.end_date) {
        const error = boundsError(year, start, end);
        if (error) return res.status(400).json({ success: false, message: error });
        const overlap = await findOverlap({
          tenantId,
          yearId: row.academic_year_id,
          examType: row.exam_type,
          start,
          end,
          excludeId: row.id,
        });
        if (overlap) {
          return res.status(409).json({
            success: false,
            message: 'Bu aralık mevcut bir sınav tarihiyle çakışıyor.',
          });
        }
      }

      await sequelize.transaction(async (t) => {
        if (body.is_active) {
          await ExamPeriod.update(
            { is_active: false },
            {
              where: {
                tenant_id: row.tenant_id,
                academic_year_id: row.academic_year_id,
                exam_type: row.exam_type,
                is_active: true,
              },
              transaction: t,
            }
          );
        }
        const patch = {};
        if (body.label !== undefined) {
          patch.label = body.label && String(body.label).trim() ? String(body.label).trim() : null;
        }
        if (body.start_date) patch.start_date = start;
        if (body.end_date) patch.end_date = end;
        if (body.is_active !== undefined) patch.is_active = body.is_active;
        await row.update(patch, { transaction: t });
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'exam_period',
        entityId: row.id,
        summary: `Sınav tarihi güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await ExamPeriod.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const wasActive = row.is_active;
      const scope = {
        tenant_id: row.tenant_id,
        academic_year_id: row.academic_year_id,
        exam_type: row.exam_type,
      };
      const id = row.id;
      const start = calendarDate(row.start_date);
      const end = calendarDate(row.end_date);
      const deletedExams = await sequelize.transaction(async (t) => {
        const removed = await Exam.destroy({
          where: {
            tenant_id: row.tenant_id,
            exam_type: row.exam_type,
            exam_date: { [Op.between]: [start, end] },
          },
          transaction: t,
        });
        await row.destroy({ transaction: t });
        if (wasActive) {
          const nextRow = await ExamPeriod.findOne({
            where: scope,
            order: [['start_date', 'ASC']],
            transaction: t,
          });
          if (nextRow) await nextRow.update({ is_active: true }, { transaction: t });
        }
        return removed;
      });
      await audit.log(req, {
        action: 'delete',
        entityType: 'exam_period',
        entityId: id,
        summary: `Sınav tarihi silindi (#${id}), ${deletedExams} sınav kaydı kaldırıldı`,
      });
      res.json({ success: true, data: { deleted_exams: deletedExams } });
    } catch (err) {
      next(err);
    }
  },
};
