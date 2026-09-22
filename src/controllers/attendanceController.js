'use strict';

const { Op } = require('sequelize');
const {
  AttendanceRecord,
  Teacher,
  Holiday,
  School,
} = require('../models');
const audit = require('../services/auditService');
const { resolvePrincipalName } = require('../services/schoolPrincipalService');
const { sendTableExport } = require('../services/exportService');
const { sendTypPuantajExport } = require('../services/typPuantajExportService');

const STATUS_LABELS = {
  geldi: 'Geldi',
  gelmedi: 'Gelmedi (D)',
  izinli: 'Ücretsiz İzin (Ü)',
  raporlu: 'Raporlu (R)',
  fazla_mesai: 'Fazla Mesai',
  mazeretli: 'Mazeretli (M)',
  is_kazasi: 'İş Kazası (İ)',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const teacherInclude = {
  model: Teacher,
  attributes: [
    'id',
    'first_name',
    'last_name',
    'personnel_no',
    'personnel_type',
    'national_id',
    'title_branch',
    'contract_start_date',
    'contract_end_date',
    'school_id',
  ],
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
      const body = req.validatedBody || req.body || {};
      const {
        format,
        year,
        month,
        closed_days,
        typ_no,
        typ_subject,
        typ_start_date,
        typ_end_date,
        school_id,
      } = body;

      const y = Number(year);
      const mNum = Number(month);
      const m = String(mNum).padStart(2, '0');
      const daysInMonth = new Date(y, mNum, 0).getDate();
      const dateFrom = `${y}-${m}-01`;
      const dateTo = `${y}-${m}-${daysInMonth}`;

      const teacherWhere = {
        tenant_id: tenantId,
        personnel_type: { [Op.in]: ['typ', 'isci'] },
      };
      if (school_id) teacherWhere.school_id = Number(school_id);

      const teachers = await Teacher.findAll({
        where: teacherWhere,
        include: [{ model: School, attributes: ['id', 'name'], required: false }],
        order: [
          ['personnel_type', 'ASC'],
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
        ],
      });

      // TYP personeli varsa yalnızca onları çizelgeye al; yoksa işçi+TYP
      const typOnly = teachers.filter((t) => t.personnel_type === 'typ');
      const exportTeachers = typOnly.length > 0 ? typOnly : teachers;

      const rows = await AttendanceRecord.findAll({
        where: {
          tenant_id: tenantId,
          attendance_date: { [Op.between]: [dateFrom, dateTo] },
          ...(exportTeachers.length
            ? { teacher_id: { [Op.in]: exportTeachers.map((t) => t.id) } }
            : {}),
        },
        include: [teacherInclude],
        order: [['attendance_date', 'ASC']],
        limit: 5000,
      });

      if (format === 'xlsx') {
        const schoolId =
          Number(school_id) ||
          exportTeachers.find((t) => t.school_id)?.school_id ||
          req.user?.school_id ||
          null;

        let schoolName = '';
        if (schoolId) {
          const school = await School.findByPk(schoolId);
          schoolName = school?.name || '';
        }
        if (!schoolName) {
          schoolName = exportTeachers.find((t) => t.School?.name)?.School?.name || '';
        }

        const principalName = await resolvePrincipalName(tenantId, schoolId);
        const holidays = await Holiday.findAll({
          where: {
            tenant_id: tenantId,
            month: mNum,
            [Op.or]: [{ year: null }, { year: y }],
          },
        });

        await sendTypPuantajExport(res, {
          year: y,
          month: mNum,
          teachers: exportTeachers,
          attendanceRows: rows,
          holidays,
          closedDays: closed_days || [],
          schoolName,
          principalName,
          typNo: typ_no || '',
          typSubject: typ_subject || '',
          typStartDate: typ_start_date || '',
          typEndDate: typ_end_date || '',
          filename: `typ-gunluk-puantaj-${y}-${m}`,
        });
        return;
      }

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
