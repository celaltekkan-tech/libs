'use strict';

const { Op } = require('sequelize');
const { ScheduleEntry, Classroom, Subject, Teacher, School, SubjectClassHour } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const DAY_LABELS = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
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
  attributes: ['id', 'name', 'code'],
  required: false,
};

const teacherInclude = {
  model: Teacher,
  as: 'Teacher',
  attributes: ['id', 'first_name', 'last_name', 'personnel_no'],
  required: false,
};

const schoolInclude = {
  model: School,
  attributes: ['id', 'name', 'code'],
  required: false,
};

const includes = [classroomInclude, subjectInclude, teacherInclude, schoolInclude];

// Bir sınıfın bir dersten haftalık ders programına eklenen saat sayısını,
// o sınıf seviyesi için tanımlanan gerekli saatle karşılaştırır. Engelleyici
// değildir; yalnızca bilgilendirici bir uyarı döner (sınav zorluk uyarısı ile
// aynı desende).
async function computeHoursWarning({ tenantId, classroomId, subjectId, academicYear }) {
  const classroom = await Classroom.findByPk(classroomId);
  if (!classroom) return null;

  const required = await SubjectClassHour.findOne({
    where: { tenant_id: tenantId, subject_id: subjectId, class_level: classroom.class_level },
  });
  if (!required) return null;

  const scheduled = await ScheduleEntry.count({
    where: {
      tenant_id: tenantId,
      classroom_id: classroomId,
      subject_id: subjectId,
      academic_year: academicYear ?? null,
    },
  });

  if (scheduled === required.weekly_hours) return null;
  const subject = await Subject.findByPk(subjectId);
  const diff = scheduled - required.weekly_hours;
  const label = diff > 0 ? `${diff} saat fazla` : `${Math.abs(diff)} saat eksik`;
  return `${classroom.class_level}/${classroom.section} sınıfında "${subject?.name || ''}" dersi haftalık ${required.weekly_hours} saat olmalı, şu an ${scheduled} saat tanımlı (${label}).`;
}

async function findClassroomConflict({ tenantId, classroomId, dayOfWeek, periodNo, academicYear, excludeId }) {
  const where = {
    tenant_id: tenantId,
    classroom_id: classroomId,
    day_of_week: dayOfWeek,
    period_no: periodNo,
    academic_year: academicYear ?? null,
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return ScheduleEntry.findOne({ where, include: [subjectInclude] });
}

async function findTeacherConflict({ tenantId, teacherId, dayOfWeek, periodNo, academicYear, excludeId }) {
  if (!teacherId) return null;
  const where = {
    tenant_id: tenantId,
    teacher_id: teacherId,
    day_of_week: dayOfWeek,
    period_no: periodNo,
    academic_year: academicYear ?? null,
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return ScheduleEntry.findOne({ where, include: [classroomInclude] });
}

const COLUMN_LABELS = {
  day_of_week: 'Gün',
  period_no: 'Ders Saati',
  classroom_label: 'Sınıf / Şube',
  subject_name: 'Ders',
  teacher_name: 'Öğretmen',
  school_name: 'Okul',
  academic_year: 'Eğitim Öğretim Yılı',
};

const DEFAULT_COLUMNS = ['day_of_week', 'period_no', 'classroom_label', 'subject_name', 'teacher_name', 'academic_year'];

function formatCell(row, key) {
  if (key === 'day_of_week') return DAY_LABELS[row.day_of_week] || String(row.day_of_week);
  if (key === 'classroom_label') return row.Classroom ? `${row.Classroom.class_level}/${row.Classroom.section}` : '';
  if (key === 'subject_name') return row.Subject?.name || '';
  if (key === 'teacher_name') return row.Teacher ? `${row.Teacher.first_name} ${row.Teacher.last_name}` : '';
  if (key === 'school_name') return row.School?.name || '';
  const value = row[key];
  if (value == null || value === '') return '';
  return String(value);
}

module.exports = {
  COLUMN_LABELS,
  DAY_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.classroom_id) where.classroom_id = Number(req.query.classroom_id);
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      if (req.query.academic_year) where.academic_year = req.query.academic_year;
      if (req.query.day_of_week) where.day_of_week = Number(req.query.day_of_week);

      const entries = await ScheduleEntry.findAll({
        where,
        include: includes,
        order: [
          ['day_of_week', 'ASC'],
          ['period_no', 'ASC'],
        ],
        limit: 2000,
      });
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const entry = await ScheduleEntry.findByPk(req.params.id, { include: includes });
      if (!entry) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, entry)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      if (payload.academic_year === '') payload.academic_year = null;

      const classroom = await Classroom.findByPk(payload.classroom_id);
      if (!classroom || (tenantId && classroom.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen sınıf/şube bulunamadı' });
      }

      const subject = await Subject.findByPk(payload.subject_id);
      if (!subject || (tenantId && subject.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen ders bulunamadı' });
      }

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
        }
      }

      const classroomConflict = await findClassroomConflict({
        tenantId,
        classroomId: payload.classroom_id,
        dayOfWeek: payload.day_of_week,
        periodNo: payload.period_no,
        academicYear: payload.academic_year,
      });
      if (classroomConflict) {
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_CLASSROOM_CONFLICT',
          message: `Bu sınıf ${DAY_LABELS[payload.day_of_week]} günü ${payload.period_no}. saatte zaten "${classroomConflict.Subject?.name || ''}" dersine ayrılmış`,
        });
      }

      const teacherConflict = await findTeacherConflict({
        tenantId,
        teacherId: payload.teacher_id,
        dayOfWeek: payload.day_of_week,
        periodNo: payload.period_no,
        academicYear: payload.academic_year,
      });
      if (teacherConflict) {
        const label = teacherConflict.Classroom
          ? `${teacherConflict.Classroom.class_level}/${teacherConflict.Classroom.section}`
          : '';
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_TEACHER_CONFLICT',
          message: `Bu öğretmen ${DAY_LABELS[payload.day_of_week]} günü ${payload.period_no}. saatte zaten ${label} sınıfında görevli`,
        });
      }

      const entry = await ScheduleEntry.create(payload);
      const full = await ScheduleEntry.findByPk(entry.id, { include: includes });
      await audit.log(req, {
        action: 'create',
        entityType: 'schedule_entry',
        entityId: entry.id,
        summary: `Ders programına kayıt eklendi: ${classroom.class_level}/${classroom.section} - ${DAY_LABELS[payload.day_of_week]} ${payload.period_no}. saat`,
      });
      const hoursWarning = await computeHoursWarning({
        tenantId,
        classroomId: payload.classroom_id,
        subjectId: payload.subject_id,
        academicYear: payload.academic_year,
      });
      res.status(201).json({ success: true, data: full, hours_warning: hoursWarning });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_CONFLICT',
          message: 'Bu gün ve saat için çakışan bir kayıt zaten var',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const entry = await ScheduleEntry.findByPk(req.params.id);
      if (!entry) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, entry)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      if (payload.academic_year === '') payload.academic_year = null;

      const nextClassroomId = payload.classroom_id ?? entry.classroom_id;
      const nextSubjectId = payload.subject_id ?? entry.subject_id;
      const nextTeacherId = payload.teacher_id === undefined ? entry.teacher_id : payload.teacher_id;
      const nextDay = payload.day_of_week ?? entry.day_of_week;
      const nextPeriod = payload.period_no ?? entry.period_no;
      const nextYear = payload.academic_year === undefined ? entry.academic_year : payload.academic_year;

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
        }
      }

      const classroomConflict = await findClassroomConflict({
        tenantId,
        classroomId: nextClassroomId,
        dayOfWeek: nextDay,
        periodNo: nextPeriod,
        academicYear: nextYear,
        excludeId: entry.id,
      });
      if (classroomConflict) {
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_CLASSROOM_CONFLICT',
          message: `Bu sınıf ${DAY_LABELS[nextDay]} günü ${nextPeriod}. saatte zaten "${classroomConflict.Subject?.name || ''}" dersine ayrılmış`,
        });
      }

      const teacherConflict = await findTeacherConflict({
        tenantId,
        teacherId: nextTeacherId,
        dayOfWeek: nextDay,
        periodNo: nextPeriod,
        academicYear: nextYear,
        excludeId: entry.id,
      });
      if (teacherConflict) {
        const label = teacherConflict.Classroom
          ? `${teacherConflict.Classroom.class_level}/${teacherConflict.Classroom.section}`
          : '';
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_TEACHER_CONFLICT',
          message: `Bu öğretmen ${DAY_LABELS[nextDay]} günü ${nextPeriod}. saatte zaten ${label} sınıfında görevli`,
        });
      }

      await entry.update({ ...payload, subject_id: nextSubjectId });
      const full = await ScheduleEntry.findByPk(entry.id, { include: includes });
      await audit.log(req, {
        action: 'update',
        entityType: 'schedule_entry',
        entityId: entry.id,
        summary: `Ders programı kaydı güncellendi (#${entry.id})`,
      });
      const hoursWarning = await computeHoursWarning({
        tenantId,
        classroomId: nextClassroomId,
        subjectId: nextSubjectId,
        academicYear: nextYear,
      });
      res.json({ success: true, data: full, hours_warning: hoursWarning });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'SCHEDULE_CONFLICT',
          message: 'Bu gün ve saat için çakışan bir kayıt zaten var',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const entry = await ScheduleEntry.findByPk(req.params.id);
      if (!entry) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, entry)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const id = entry.id;
      const tenantId = req.user && req.user.tenant_id;
      const { classroom_id: classroomId, subject_id: subjectId, academic_year: academicYear } = entry;
      await entry.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'schedule_entry',
        entityId: id,
        summary: `Ders programı kaydı silindi (#${id})`,
      });
      const hoursWarning = await computeHoursWarning({ tenantId, classroomId, subjectId, academicYear });
      res.json({ success: true, hours_warning: hoursWarning });
    } catch (err) {
      next(err);
    }
  },

  // Bir sınıfın tüm dersleri için tanımlanan gerekli haftalık saat ile ders
  // programına eklenen gerçek saat sayısını karşılaştırır (eksik/fazla/tam).
  async hoursCheck(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const classroomId = Number(req.query.classroom_id);
      if (!classroomId) {
        return res.status(400).json({ success: false, message: 'classroom_id zorunludur' });
      }
      const academicYear = req.query.academic_year || null;

      const classroom = await Classroom.findByPk(classroomId);
      if (!classroom || (tenantId && classroom.tenant_id !== tenantId)) {
        return res.status(404).json({ success: false, message: 'Sınıf bulunamadı' });
      }

      const requirements = await SubjectClassHour.findAll({
        where: { tenant_id: tenantId, class_level: classroom.class_level },
        include: [{ model: Subject, attributes: ['id', 'name'] }],
      });

      const entries = await ScheduleEntry.findAll({
        where: { tenant_id: tenantId, classroom_id: classroomId, academic_year: academicYear },
      });
      const scheduledBySubject = new Map();
      entries.forEach((e) => {
        scheduledBySubject.set(e.subject_id, (scheduledBySubject.get(e.subject_id) || 0) + 1);
      });

      const data = requirements.map((req_) => {
        const scheduled = scheduledBySubject.get(req_.subject_id) || 0;
        const diff = scheduled - req_.weekly_hours;
        return {
          subject_id: req_.subject_id,
          subject_name: req_.Subject?.name || '',
          required_hours: req_.weekly_hours,
          scheduled_hours: scheduled,
          status: diff === 0 ? 'tam' : diff > 0 ? 'fazla' : 'eksik',
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async teacherLoad(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.academic_year) where.academic_year = req.query.academic_year;
      where.teacher_id = { [Op.ne]: null };

      const entries = await ScheduleEntry.findAll({
        where,
        include: [teacherInclude, subjectInclude],
      });

      const byTeacher = new Map();
      for (const entry of entries) {
        if (!entry.Teacher) continue;
        const key = entry.teacher_id;
        if (!byTeacher.has(key)) {
          byTeacher.set(key, {
            teacher_id: key,
            teacher_name: `${entry.Teacher.first_name} ${entry.Teacher.last_name}`,
            personnel_no: entry.Teacher.personnel_no,
            total_hours: 0,
            subjects: new Map(),
          });
        }
        const bucket = byTeacher.get(key);
        bucket.total_hours += 1;
        const subjectName = entry.Subject?.name || 'Diğer';
        bucket.subjects.set(subjectName, (bucket.subjects.get(subjectName) || 0) + 1);
      }

      const data = Array.from(byTeacher.values())
        .map((row) => ({
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          personnel_no: row.personnel_no,
          total_hours: row.total_hours,
          subjects: Array.from(row.subjects.entries()).map(([name, hours]) => ({ name, hours })),
        }))
        .sort((a, b) => b.total_hours - a.total_hours);

      res.json({ success: true, data });
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
      if (filters?.classroom_id) where.classroom_id = Number(filters.classroom_id);
      if (filters?.teacher_id) where.teacher_id = Number(filters.teacher_id);
      if (filters?.school_id) where.school_id = Number(filters.school_id);
      if (filters?.academic_year) where.academic_year = filters.academic_year;

      const entries = await ScheduleEntry.findAll({
        where,
        include: includes,
        order: [
          ['day_of_week', 'ASC'],
          ['period_no', 'ASC'],
        ],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'ders-programi',
        title: 'Haftalık Ders Programı',
        headers: allowed.map((key) => COLUMN_LABELS[key]),
        rows: entries.map((row) => allowed.map((key) => formatCell(row, key))),
      });
    } catch (err) {
      next(err);
    }
  },
};
