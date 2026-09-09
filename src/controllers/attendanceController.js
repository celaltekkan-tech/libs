'use strict';

const { Op } = require('sequelize');
const { AttendanceRecord, Teacher } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const STATUS_LABELS = {
  geldi: 'Geldi',
  gelmedi: 'Gelmedi',
  izinli: 'İzinli',
  raporlu: 'Raporlu',
  fazla_mesai: 'Fazla Mesai',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const teacherInclude = {
  model: Teacher,
  attributes: ['id', 'first_name', 'last_name', 'personnel_no', 'personnel_type'],
  required: false,
};

module.exports = {
  STATUS_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.attendance_date) where.attendance_date = req.query.attendance_date;
      if (req.query.year && req.query.month) {
        const y = Number(req.query.year);
        const m = String(Number(req.query.month)).padStart(2, '0');
        const daysInMonth = new Date(y, Number(req.query.month), 0).getDate();
        where.attendance_date = { [Op.between]: [`${y}-${m}-01`, `${y}-${m}-${daysInMonth}`] };
      }

      const rows = await AttendanceRecord.findAll({
        where,
        include: [teacherInclude],
        order: [['attendance_date', 'DESC']],
        limit: 5000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async bulkUpsert(req, res, next) {
    try {
      const { attendance_date, entries } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      const results = [];
      for (const entry of entries) {
        const [row] = await AttendanceRecord.findOrCreate({
          where: { tenant_id: tenantId, teacher_id: entry.teacher_id, attendance_date },
          defaults: {
            tenant_id: tenantId,
            teacher_id: entry.teacher_id,
            attendance_date,
            status: entry.status,
            overtime_hours: entry.overtime_hours ?? null,
            notes: entry.notes ?? null,
          },
        });
        await row.update({
          status: entry.status,
          overtime_hours: entry.overtime_hours ?? null,
          notes: entry.notes ?? null,
        });
        results.push(row);
      }

      await audit.log(req, {
        action: 'update',
        entityType: 'attendance_record_batch',
        summary: `Günlük puantaj girişi kaydedildi: ${attendance_date} (${results.length} kayıt)`,
      });

      res.json({ success: true, data: { count: results.length } });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await AttendanceRecord.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
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
      const m = String(month).padStart(2, '0');
      const daysInMonth = new Date(year, month, 0).getDate();

      const rows = await AttendanceRecord.findAll({
        where: {
          tenant_id: tenantId,
          attendance_date: {
            [Op.between]: [`${year}-${m}-01`, `${year}-${m}-${daysInMonth}`],
          },
        },
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
            counts: {},
            overtime_total: 0,
          });
        }
        const bucket = byTeacher.get(key);
        bucket.counts[row.status] = (bucket.counts[row.status] || 0) + 1;
        bucket.overtime_total += Number(row.overtime_hours || 0);
      });

      res.json({ success: true, data: Array.from(byTeacher.values()) });
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
      if (year && month) {
        const m = String(Number(month)).padStart(2, '0');
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        where.attendance_date = { [Op.between]: [`${year}-${m}-01`, `${year}-${m}-${daysInMonth}`] };
      }

      const rows = await AttendanceRecord.findAll({
        where,
        include: [teacherInclude],
        order: [['attendance_date', 'ASC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'puantaj-cizelgesi',
        title: 'İşçi / TYP Puantaj Çizelgesi',
        headers: ['Personel', 'Tarih', 'Durum', 'Fazla Mesai (saat)', 'Not'],
        rows: rows.map((r) => [
          r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '',
          r.attendance_date,
          STATUS_LABELS[r.status] || r.status,
          r.overtime_hours || '',
          r.notes || '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
