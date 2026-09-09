'use strict';

const { TeacherDocument, Teacher } = require('../models');
const audit = require('../services/auditService');

const DOC_TYPE_LABELS = {
  yillik_plan: 'Yıllık Plan',
  zumre_tutanagi: 'Zümre Tutanağı',
  sinif_rehberlik_plani: 'Sınıf Rehberlik Planı',
  kulup_raporu: 'Kulüp / Toplum Hizmeti Raporu',
  maarif_modeli_raporu: 'Maarif Modeli Etkinlik Raporu',
  ogrenci_gelisim_raporu: 'Öğrenci Gelişim Raporu',
  diger: 'Diğer',
};

const STATUS_LABELS = {
  taslak: 'Taslak',
  teslim_edildi: 'Teslim Edildi',
  onaylandi: 'Onaylandı',
  revizyon_istendi: 'Revizyon İstendi',
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
  DOC_TYPE_LABELS,
  STATUS_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.doc_type) where.doc_type = req.query.doc_type;
      if (req.query.status) where.status = req.query.status;

      const rows = await TeacherDocument.findAll({
        where,
        include: [teacherInclude],
        order: [['updated_at', 'DESC']],
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

      const teacher = await Teacher.findByPk(payload.teacher_id);
      if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
      }

      const row = await TeacherDocument.create(payload);
      const full = await TeacherDocument.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'teacher_document',
        entityId: row.id,
        summary: `Evrak oluşturuldu: ${teacher.first_name} ${teacher.last_name} - ${DOC_TYPE_LABELS[payload.doc_type]}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await TeacherDocument.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      if (['onaylandi'].includes(row.status)) {
        return res.status(409).json({ success: false, message: 'Onaylanmış evrak düzenlenemez' });
      }
      await row.update(req.validatedBody || req.body);
      const full = await TeacherDocument.findByPk(row.id, { include: [teacherInclude] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  // Yönetici teslim durumunu günceller (teslim edildi / onaylandı / revizyon istendi).
  async review(req, res, next) {
    try {
      const row = await TeacherDocument.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const { status, reviewer_note } = req.validatedBody || req.body;
      await row.update({ status, reviewer_note: reviewer_note ?? row.reviewer_note });
      const full = await TeacherDocument.findByPk(row.id, { include: [teacherInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'teacher_document',
        entityId: row.id,
        summary: `Evrak durumu güncellendi: ${STATUS_LABELS[status]} (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await TeacherDocument.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // Önceki yıla ait evrakı yeni eğitim öğretim yılı için taslak olarak kopyalar.
  async duplicate(req, res, next) {
    try {
      const source = await TeacherDocument.findByPk(req.params.id);
      if (!source) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, source)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { academic_year } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      const copy = await TeacherDocument.create({
        tenant_id: tenantId,
        teacher_id: source.teacher_id,
        doc_type: source.doc_type,
        title: source.title,
        academic_year,
        content: source.content,
        status: 'taslak',
      });
      const full = await TeacherDocument.findByPk(copy.id, { include: [teacherInclude] });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },
};
