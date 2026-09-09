'use strict';

const { ExtraLessonEntry, Teacher, ScheduleEntry, LeaveRecord } = require('../models');
const { Op } = require('sequelize');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const CATEGORY_LABELS = {
  ders_yuku: 'Ders Yükü',
  nobet: 'Nöbet',
  dyk: 'DYK',
  egzersiz: 'Egzersiz',
  sinav_gorevi: 'Sınav Görevi',
  belletici: 'Belletici',
  hazirlik_planlama: 'Hazırlık / Planlama',
  kesinti: 'Kesinti',
  diger: 'Diğer',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const teacherInclude = {
  model: Teacher,
  attributes: ['id', 'first_name', 'last_name', 'personnel_no'],
  required: false,
};

module.exports = {
  CATEGORY_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.year) where.year = Number(req.query.year);
      if (req.query.month) where.month = Number(req.query.month);

      const rows = await ExtraLessonEntry.findAll({
        where,
        include: [teacherInclude],
        order: [
          ['year', 'DESC'],
          ['month', 'DESC'],
        ],
        limit: 3000,
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

      const teacher = await Teacher.findByPk(payload.teacher_id);
      if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen personel bulunamadı' });
      }

      const row = await ExtraLessonEntry.create(payload);
      const full = await ExtraLessonEntry.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'extra_lesson_entry',
        entityId: row.id,
        summary: `Ek ders kaydı eklendi: ${teacher.first_name} ${teacher.last_name} - ${CATEGORY_LABELS[payload.category]} (${payload.hours} saat)`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await ExtraLessonEntry.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = { ...(req.validatedBody || req.body) };
      await row.update(payload);
      const full = await ExtraLessonEntry.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'extra_lesson_entry',
        entityId: row.id,
        summary: `Ek ders kaydı güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await ExtraLessonEntry.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'extra_lesson_entry',
        entityId: id,
        summary: `Ek ders kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // Ders programındaki haftalık ders sayısına göre o ay için tahmini ders yükü
  // saatini önerir (haftalık slot sayısı × ayın içindeki o güne denk gelen hafta sayısı).
  // Kesin MEBBİS hesaplaması değildir; kullanıcı öneriyi düzenleyerek kaydeder.
  async suggestLessonLoad(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const teacherId = Number(req.query.teacher_id);
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!teacherId || !year || !month) {
        return res.status(400).json({ success: false, message: 'teacher_id, year ve month zorunludur' });
      }

      const entries = await ScheduleEntry.findAll({ where: { tenant_id: tenantId, teacher_id: teacherId } });
      const daysInMonth = new Date(year, month, 0).getDate();
      let totalSlots = 0;
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const jsDay = date.getDay(); // 0=Pazar
        const dow = jsDay === 0 ? 7 : jsDay; // ScheduleEntry: 1=Pazartesi..6=Cumartesi, Pazar kullanılmıyor
        if (dow > 6) continue;
        totalSlots += entries.filter((e) => e.day_of_week === dow).length;
      }

      const leaves = await LeaveRecord.findAll({
        where: {
          tenant_id: tenantId,
          teacher_id: teacherId,
          start_date: { [Op.lte]: `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}` },
          end_date: { [Op.gte]: `${year}-${String(month).padStart(2, '0')}-01` },
        },
      });
      const leaveDayTotal = leaves.reduce((sum, l) => sum + l.day_count, 0);

      res.json({
        success: true,
        data: {
          suggested_hours: totalSlots,
          leave_days_in_period: leaveDayTotal,
          note: 'Bu bir tahmindir; ders programındaki haftalık slotların ay içinde kaç kez tekrarladığına dayanır.',
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async monthlySummary(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month) {
        return res.status(400).json({ success: false, message: 'year ve month zorunludur' });
      }

      const rows = await ExtraLessonEntry.findAll({
        where: { tenant_id: tenantId, year, month },
        include: [teacherInclude],
      });

      const byTeacher = new Map();
      rows.forEach((row) => {
        if (!row.Teacher) return;
        const key = row.teacher_id;
        if (!byTeacher.has(key)) {
          byTeacher.set(key, {
            teacher_id: key,
            teacher_name: `${row.Teacher.first_name} ${row.Teacher.last_name}`,
            personnel_no: row.Teacher.personnel_no,
            total_hours: 0,
            categories: {},
          });
        }
        const bucket = byTeacher.get(key);
        bucket.total_hours += Number(row.hours);
        bucket.categories[row.category] = (bucket.categories[row.category] || 0) + Number(row.hours);
      });

      res.json({ success: true, data: Array.from(byTeacher.values()).sort((a, b) => b.total_hours - a.total_hours) });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, year, month } = req.validatedBody || req.body || {};
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (year) where.year = Number(year);
      if (month) where.month = Number(month);

      const rows = await ExtraLessonEntry.findAll({
        where,
        include: [teacherInclude],
        order: [['teacher_id', 'ASC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'ek-ders-cizelgesi',
        title: 'Aylık Ek Ders Çizelgesi',
        headers: ['Personel', 'Yıl', 'Ay', 'Kategori', 'Saat', 'Not'],
        rows: rows.map((r) => [
          r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '',
          r.year,
          r.month,
          CATEGORY_LABELS[r.category] || r.category,
          r.hours,
          r.notes || '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
