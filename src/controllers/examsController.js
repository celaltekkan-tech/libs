'use strict';

const { Op } = require('sequelize');
const { Exam, Classroom, Subject } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const EXAM_TYPE_LABELS = {
  yazili: 'Yazılı Sınav',
  ortak: 'Ortak Sınav',
  telafi: 'Telafi Sınavı',
  sorumluluk: 'Sorumluluk Sınavı',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const classroomInclude = {
  model: Classroom,
  attributes: ['id', 'class_level', 'section', 'academic_year'],
  required: false,
};

const subjectInclude = {
  model: Subject,
  attributes: ['id', 'name', 'difficulty_level'],
  required: false,
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  EXAM_TYPE_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.classroom_id) where.classroom_id = Number(req.query.classroom_id);
      if (req.query.start_date && req.query.end_date) {
        where.exam_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
      }

      const rows = await Exam.findAll({
        where,
        include: [classroomInclude, subjectInclude],
        order: [['exam_date', 'ASC']],
        limit: 2000,
      });
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

      const classroom = await Classroom.findByPk(payload.classroom_id);
      if (!classroom || (tenantId && classroom.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen sınıf/şube bulunamadı' });
      }
      const subject = await Subject.findByPk(payload.subject_id);
      if (!subject || (tenantId && subject.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen ders bulunamadı' });
      }

      const row = await Exam.create(payload);

      // Ardışık gün zor ders uyarısı: engelleyici değil, bilgilendirici (soft warning).
      let warning = null;
      if (subject.difficulty_level === 'zor') {
        const prevDay = addDays(payload.exam_date, -1);
        const nextDay = addDays(payload.exam_date, 1);
        const adjacent = await Exam.findOne({
          where: {
            tenant_id: tenantId,
            classroom_id: payload.classroom_id,
            exam_date: { [Op.in]: [prevDay, nextDay] },
          },
          include: [subjectInclude],
        });
        if (adjacent && adjacent.Subject?.difficulty_level === 'zor') {
          warning = `Dikkat: bu sınıfın ${adjacent.exam_date} tarihinde de zor bir ders sınavı var. Ardışık zor ders sınavı önerilmez.`;
        }
      }

      const full = await Exam.findByPk(row.id, { include: [classroomInclude, subjectInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'exam',
        entityId: row.id,
        summary: `Sınav planlandı: ${classroom.class_level}/${classroom.section} - ${subject.name} (${payload.exam_date})`,
      });
      res.status(201).json({ success: true, data: full, warning });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'EXAM_CONFLICT',
          message: 'Bu sınıf için o tarihte zaten bir sınav planlanmış',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await Exam.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = { ...(req.validatedBody || req.body) };
      await row.update(payload);
      const full = await Exam.findByPk(row.id, { include: [classroomInclude, subjectInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'exam',
        entityId: row.id,
        summary: `Sınav güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'EXAM_CONFLICT',
          message: 'Bu sınıf için o tarihte zaten bir sınav planlanmış',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await Exam.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'exam',
        entityId: id,
        summary: `Sınav kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, start_date, end_date } = req.validatedBody || req.body || {};
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (start_date && end_date) where.exam_date = { [Op.between]: [start_date, end_date] };

      const rows = await Exam.findAll({
        where,
        include: [classroomInclude, subjectInclude],
        order: [['exam_date', 'ASC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'sinav-programi',
        title: 'Sınav Programı',
        headers: ['Tarih', 'Saat', 'Sınıf', 'Ders', 'Tür', 'Süre (dk)'],
        rows: rows.map((r) => [
          r.exam_date,
          r.start_time || '',
          r.Classroom ? `${r.Classroom.class_level}/${r.Classroom.section}` : '',
          r.Subject?.name || '',
          EXAM_TYPE_LABELS[r.exam_type] || r.exam_type,
          r.duration_minutes || '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
