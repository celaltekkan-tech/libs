'use strict';

const { Op } = require('sequelize');
const { LeaveRecord, Teacher, Holiday } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

// 657 sayılı Devlet Memurları Kanunu madde 102: hizmeti 1-10 yıl (10 dahil) olanlara
// 20 gün, 10 yıldan fazla olanlara 30 gün yıllık izin verilir. service_start_date
// tanımsızsa veya personel bazlı annual_leave_quota override edilmişse buna göre geriler.
const STANDARD_ANNUAL_LEAVE_DAYS = 20;
const SENIOR_ANNUAL_LEAVE_DAYS = 30;
const SENIORITY_THRESHOLD_YEARS = 10;

function serviceYearsAt(serviceStartDate, referenceDate) {
  const start = new Date(serviceStartDate);
  const diffMs = referenceDate.getTime() - start.getTime();
  return diffMs / (365.25 * 86400000);
}

/**
 * @returns {{ quota: number, source: 'override'|'auto'|'default' }}
 */
function resolveAnnualLeaveQuota(teacher, referenceDate) {
  if (teacher.annual_leave_quota != null) {
    return { quota: teacher.annual_leave_quota, source: 'override' };
  }
  if (teacher.service_start_date) {
    const years = serviceYearsAt(teacher.service_start_date, referenceDate);
    const quota = years > SENIORITY_THRESHOLD_YEARS ? SENIOR_ANNUAL_LEAVE_DAYS : STANDARD_ANNUAL_LEAVE_DAYS;
    return { quota, source: 'auto' };
  }
  return { quota: STANDARD_ANNUAL_LEAVE_DAYS, source: 'default' };
}

const LEAVE_TYPE_LABELS = {
  yillik: 'Yıllık İzin',
  mazeret: 'Mazeret İzni',
  rapor: 'Rapor',
  ucretsiz: 'Ücretsiz İzin',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

function dayCount(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff + 1;
}

const teacherInclude = {
  model: Teacher,
  attributes: ['id', 'first_name', 'last_name', 'personnel_no', 'annual_leave_quota', 'service_start_date'],
  required: false,
};

const COLUMN_LABELS = {
  teacher_name: 'Personel',
  leave_type: 'İzin Türü',
  start_date: 'Başlangıç',
  end_date: 'Bitiş',
  day_count: 'Gün Sayısı',
  reason: 'Açıklama',
};

const DEFAULT_COLUMNS = ['teacher_name', 'leave_type', 'start_date', 'end_date', 'day_count', 'reason'];

function formatCell(row, key) {
  if (key === 'teacher_name') return row.Teacher ? `${row.Teacher.first_name} ${row.Teacher.last_name}` : '';
  if (key === 'leave_type') return LEAVE_TYPE_LABELS[row.leave_type] || row.leave_type;
  const value = row[key];
  if (value == null || value === '') return '';
  return String(value);
}

module.exports = {
  COLUMN_LABELS,
  LEAVE_TYPE_LABELS,

  // Ay bazlı takvim görünümü: her gün için resmi tatil bilgisi ve izinli
  // personel listesi + toplam personele oranı (gün hücresinin renk yoğunluğu
  // frontend'de bu orana göre hesaplanır).
  async calendar(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month) {
        return res.status(400).json({ success: false, message: 'year ve month zorunludur' });
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const totalPersonnel = await Teacher.count({ where: { tenant_id: tenantId } });

      const holidays = await Holiday.findAll({ where: { tenant_id: tenantId, month } });
      const holidayByDay = new Map();
      holidays.forEach((h) => {
        if (h.year == null || h.year === year) holidayByDay.set(h.day, h.name);
      });

      const leaves = await LeaveRecord.findAll({
        where: {
          tenant_id: tenantId,
          start_date: { [Op.lte]: monthEnd },
          end_date: { [Op.gte]: monthStart },
        },
        include: [{ model: Teacher, attributes: ['id', 'first_name', 'last_name', 'personnel_no'] }],
      });

      const days = [];
      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const onLeave = leaves.filter((l) => dateStr >= l.start_date && dateStr <= l.end_date);
        days.push({
          date: dateStr,
          day,
          is_holiday: holidayByDay.has(day),
          holiday_name: holidayByDay.get(day) || null,
          leave_count: onLeave.length,
          leave_ratio: totalPersonnel > 0 ? onLeave.length / totalPersonnel : 0,
          teachers: onLeave.map((l) => ({
            teacher_id: l.teacher_id,
            teacher_name: l.Teacher ? `${l.Teacher.first_name} ${l.Teacher.last_name}` : null,
            personnel_no: l.Teacher?.personnel_no || null,
            leave_type: l.leave_type,
          })),
        });
      }

      res.json({ success: true, data: { total_personnel: totalPersonnel, days } });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.leave_type) where.leave_type = req.query.leave_type;
      if (req.query.year) {
        const year = Number(req.query.year);
        where.start_date = { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` };
      }

      const rows = await LeaveRecord.findAll({
        where,
        include: [teacherInclude],
        order: [['start_date', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await LeaveRecord.findByPk(req.params.id, { include: [teacherInclude] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: row });
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

      payload.day_count = dayCount(payload.start_date, payload.end_date);

      const row = await LeaveRecord.create(payload);
      const full = await LeaveRecord.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'leave_record',
        entityId: row.id,
        summary: `İzin kaydı oluşturuldu: ${teacher.first_name} ${teacher.last_name} (${LEAVE_TYPE_LABELS[payload.leave_type]})`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await LeaveRecord.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      const nextStart = payload.start_date ?? row.start_date;
      const nextEnd = payload.end_date ?? row.end_date;
      if (new Date(nextEnd) < new Date(nextStart)) {
        return res.status(400).json({ success: false, message: 'Bitiş tarihi başlangıçtan önce olamaz' });
      }
      payload.day_count = dayCount(nextStart, nextEnd);

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen personel bulunamadı' });
        }
      }

      await row.update(payload);
      const full = await LeaveRecord.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'leave_record',
        entityId: row.id,
        summary: `İzin kaydı güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await LeaveRecord.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'leave_record',
        entityId: id,
        summary: `İzin kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async summary(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      if (!req.query.teacher_id) {
        return res.status(400).json({ success: false, message: 'teacher_id zorunludur' });
      }
      const teacherId = Number(req.query.teacher_id);
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      const teacher = await Teacher.findByPk(teacherId);
      if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
        return res.status(404).json({ success: false, message: 'Personel bulunamadı' });
      }

      const where = {
        teacher_id: teacherId,
        start_date: { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` },
      };
      if (tenantId) where.tenant_id = tenantId;

      const rows = await LeaveRecord.findAll({ where });
      const totals = {};
      for (const type of Object.keys(LEAVE_TYPE_LABELS)) totals[type] = 0;
      for (const row of rows) {
        totals[row.leave_type] = (totals[row.leave_type] || 0) + row.day_count;
      }

      // Kıdeme bağlı kota, o iznin ait olduğu yılın başındaki hizmet süresine göre belirlenir.
      const { quota, source } = resolveAnnualLeaveQuota(teacher, new Date(`${year}-01-01`));
      const remaining = quota - (totals.yillik || 0);

      res.json({
        success: true,
        data: {
          teacher_id: teacherId,
          year,
          totals,
          annual_leave_quota: quota,
          annual_leave_quota_source: source,
          remaining_annual_leave: remaining,
        },
      });
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
      if (filters?.teacher_id) where.teacher_id = Number(filters.teacher_id);
      if (filters?.leave_type) where.leave_type = filters.leave_type;
      if (filters?.year) {
        where.start_date = { [Op.gte]: `${filters.year}-01-01`, [Op.lte]: `${filters.year}-12-31` };
      }

      const rows = await LeaveRecord.findAll({
        where,
        include: [teacherInclude],
        order: [['start_date', 'DESC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'izin-kayitlari',
        title: 'Personel İzin Kayıtları',
        headers: allowed.map((key) => COLUMN_LABELS[key]),
        rows: rows.map((row) => allowed.map((key) => formatCell(row, key))),
      });
    } catch (err) {
      next(err);
    }
  },
};
