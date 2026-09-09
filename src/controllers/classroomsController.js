'use strict';

const { Classroom, Teacher, School, Student } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

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

const COLUMN_LABELS = {
  class_level: 'Sınıf',
  section: 'Şube',
  classroom_label: 'Sınıf / Şube',
  teacher_name: 'Sınıf Öğretmeni',
  school_name: 'Okul',
  academic_year: 'Eğitim Öğretim Yılı',
  is_active: 'Durum',
};

const DEFAULT_COLUMNS = [
  'class_level',
  'section',
  'teacher_name',
  'school_name',
  'academic_year',
  'is_active',
];

function matchesClassroomSearch(row, q) {
  const needle = String(q || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
  if (!needle) return true;
  const label = `${row.class_level}/${row.section}`.toLocaleLowerCase('tr-TR');
  const teacherName = row.Teacher
    ? `${row.Teacher.first_name} ${row.Teacher.last_name}`.toLocaleLowerCase('tr-TR')
    : '';
  const schoolName = (row.School?.name || '').toLocaleLowerCase('tr-TR');
  return (
    label.includes(needle) ||
    String(row.class_level || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(row.section || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(row.academic_year || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    teacherName.includes(needle) ||
    schoolName.includes(needle)
  );
}

function formatClassroomCell(row, key) {
  if (key === 'classroom_label') {
    const base = `${row.class_level}/${row.section}`;
    return row.academic_year ? `${base} (${row.academic_year})` : base;
  }
  if (key === 'teacher_name') {
    return row.Teacher ? `${row.Teacher.first_name} ${row.Teacher.last_name}` : '';
  }
  if (key === 'school_name') return row.School?.name || '';
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
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      if (req.query.is_active === 'true') where.is_active = true;
      if (req.query.is_active === 'false') where.is_active = false;

      const classrooms = await Classroom.findAll({
        where,
        include: [teacherInclude, schoolInclude],
        order: [
          ['class_level', 'ASC'],
          ['section', 'ASC'],
        ],
        limit: 1000,
      });
      res.json({ success: true, data: classrooms });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const classroom = await Classroom.findByPk(req.params.id, {
        include: [teacherInclude, schoolInclude],
      });
      if (!classroom) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, classroom)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: classroom });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.academic_year === '') payload.academic_year = null;
      if (payload.is_active == null) payload.is_active = true;

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id)) {
          return res.status(400).json({
            success: false,
            message: 'Seçilen sınıf öğretmeni bulunamadı',
          });
        }
      }

      const classroom = await Classroom.create(payload);
      const full = await Classroom.findByPk(classroom.id, {
        include: [teacherInclude, schoolInclude],
      });
      await audit.log(req, {
        action: 'create',
        entityType: 'classroom',
        entityId: classroom.id,
        summary: `Sınıf/şube oluşturuldu: ${classroom.class_level}/${classroom.section}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_CLASSROOM',
          message: 'Bu okul için aynı sınıf/şube tanımı zaten var',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const classroom = await Classroom.findByPk(req.params.id);
      if (!classroom) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, classroom)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.academic_year === '') payload.academic_year = null;

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id)) {
          return res.status(400).json({
            success: false,
            message: 'Seçilen sınıf öğretmeni bulunamadı',
          });
        }
      }

      await classroom.update(payload);

      if (payload.class_level || payload.section) {
        await Student.update(
          {
            class_level: classroom.class_level,
            section: classroom.section,
          },
          { where: { classroom_id: classroom.id } }
        );
      }

      const full = await Classroom.findByPk(classroom.id, {
        include: [teacherInclude, schoolInclude],
      });
      await audit.log(req, {
        action: 'update',
        entityType: 'classroom',
        entityId: classroom.id,
        summary: `Sınıf/şube güncellendi: ${classroom.class_level}/${classroom.section}`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_CLASSROOM',
          message: 'Bu okul için aynı sınıf/şube tanımı zaten var',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const classroom = await Classroom.findByPk(req.params.id);
      if (!classroom) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, classroom)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const studentCount = await Student.count({ where: { classroom_id: classroom.id } });
      if (studentCount > 0) {
        return res.status(409).json({
          success: false,
          code: 'CLASSROOM_HAS_STUDENTS',
          message: `Bu sınıfa bağlı ${studentCount} öğrenci var. Önce öğrencileri taşıyın veya silin.`,
        });
      }

      const label = `${classroom.class_level}/${classroom.section}`;
      const id = classroom.id;
      await classroom.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'classroom',
        entityId: id,
        summary: `Sınıf/şube silindi: ${label}`,
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
      if (filters?.school_id) where.school_id = Number(filters.school_id);
      if (typeof filters?.is_active === 'boolean') where.is_active = filters.is_active;

      let classrooms = await Classroom.findAll({
        where,
        include: [teacherInclude, schoolInclude],
        order: [
          ['class_level', 'ASC'],
          ['section', 'ASC'],
        ],
        limit: 5000,
      });

      if (filters?.q) {
        classrooms = classrooms.filter((row) => matchesClassroomSearch(row, filters.q));
      }

      await sendTableExport(res, {
        format,
        filename: 'siniflar',
        title: 'Sınıf / Şube Listesi',
        headers: allowed.map((key) => COLUMN_LABELS[key]),
        rows: classrooms.map((row) => allowed.map((key) => formatClassroomCell(row, key))),
      });
    } catch (err) {
      next(err);
    }
  },
};
