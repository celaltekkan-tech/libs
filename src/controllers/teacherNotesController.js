'use strict';

const { Op } = require('sequelize');
const { TeacherNote, Student, Classroom, User } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

// Mobil uygulamada öğretmenin çoklu seçtiği hazır sebepler; öğretmen bunlara
// ek olarak serbest metin de yazabilir (tags dizisine düz string olarak girer).
const SUGGESTED_TAGS = [
  'Kılık kıyafet uyumsuzluğu',
  'Geç kalma',
  'Uygunsuz davranış gösterme',
  'Derse malzemesiz gelme',
  'Kurallara uymama',
  'Sınıf düzenini bozma',
  'Saygısız konuşma',
  'Cep telefonu kullanımı',
];

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const includes = [
  {
    model: Student,
    attributes: ['id', 'first_name', 'last_name', 'student_number'],
    include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
    required: false,
  },
  {
    model: User,
    as: 'Teacher',
    attributes: ['id', 'full_name'],
    required: false,
  },
];

module.exports = {
  SUGGESTED_TAGS,

  async tagOptions(req, res) {
    res.json({ success: true, data: SUGGESTED_TAGS });
  },

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);

      const rows = await TeacherNote.findAll({
        where,
        include: includes,
        order: [['created_at', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  // Mobil uygulamadaki "Geçmiş Bildirimlerim" ekranı için: discipline.read izni
  // olmayan öğretmenler de yalnızca kendi oluşturdukları bildirimleri görebilir.
  async mine(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = { teacher_id: req.user.user_id };
      if (tenantId) where.tenant_id = tenantId;

      const rows = await TeacherNote.findAll({
        where,
        include: includes,
        order: [['created_at', 'DESC']],
        limit: 100,
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

      const student = await Student.findByPk(payload.student_id);
      if (!student || (tenantId && student.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğrenci bulunamadı' });
      }

      const row = await TeacherNote.create({
        tenant_id: tenantId,
        school_id: req.user && req.user.school_id,
        student_id: payload.student_id,
        teacher_id: req.user.user_id,
        tags: payload.tags || [],
        note: payload.note || null,
      });
      const full = await TeacherNote.findByPk(row.id, { include: includes });

      await audit.log(req, {
        action: 'create',
        entityType: 'teacher_note',
        entityId: row.id,
        summary: `Öğretmen bildirimi oluşturuldu: ${student.first_name} ${student.last_name}`,
      });

      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, ids } = req.validatedBody || req.body || {};
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (Array.isArray(ids)) where.id = { [Op.in]: ids.length ? ids : [0] };

      const rows = await TeacherNote.findAll({
        where,
        include: includes,
        order: [['created_at', 'DESC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'ogretmen-bildirimleri',
        title: 'Öğretmen Bildirimleri',
        headers: ['Öğrenci No', 'Adı Soyadı', 'Sınıf', 'Bildiren Öğretmen', 'Sebepler', 'Not', 'Tarih'],
        rows: rows.map((row) => {
          const student = row.Student;
          const classroom = student && student.Classroom
            ? `${student.Classroom.class_level}/${student.Classroom.section}`
            : '';
          const when = row.created_at ? new Date(row.created_at) : null;
          const dateText = when && !Number.isNaN(when.getTime())
            ? when.toLocaleString('tr-TR')
            : '';
          return [
            (student && student.student_number) || '',
            student ? `${student.first_name} ${student.last_name}` : '',
            classroom,
            (row.Teacher && row.Teacher.full_name) || '',
            Array.isArray(row.tags) ? row.tags.join(', ') : '',
            row.note || '',
            dateText,
          ];
        }),
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await TeacherNote.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'teacher_note',
        entityId: id,
        summary: `Öğretmen bildirimi silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
