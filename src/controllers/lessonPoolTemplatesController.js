'use strict';

// Platform yönetimi: MEB haftalık ders çizelgesinden hazır ders havuzları.

const { LessonPoolTemplate } = require('../models');
const audit = require('../services/auditService');
const { parseLessonPoolFile } = require('../services/lessonPoolParser');
const { sanitizeItems } = require('../services/lessonPoolTemplateService');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, next, err) {
  if (err.status && err.status < 500) return res.status(err.status).json({ success: false, message: err.message });
  return next(err);
}

function summary(t) {
  const items = t.items || [];
  return {
    id: t.id,
    name: t.name,
    school_type: t.school_type,
    levels: t.levels,
    source_name: t.source_name,
    note: t.note,
    is_active: t.is_active,
    item_count: items.length,
    elective_count: items.filter((i) => i.kind === 'secmeli').length,
    updated_at: t.updated_at,
  };
}

function payloadFrom(body) {
  const levels = [...new Set((body.levels || []).map((l) => String(l).trim()).filter(Boolean))];
  if (!levels.length) throw httpError(400, 'En az bir sınıf seviyesi gerekli');
  const items = sanitizeItems(body.items, levels);
  if (!items.length) throw httpError(400, 'En az bir ders gerekli');
  return {
    name: body.name,
    school_type: body.school_type || null,
    levels,
    items,
    source_name: body.source_name || null,
    note: body.note || null,
    ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
  };
}

module.exports = {
  // Dosyayı ayrıştırır, kaydetmez; önizleme için çizelgeleri döner.
  async parse(req, res, next) {
    try {
      if (!req.file) throw httpError(400, 'Dosya seçilmedi');
      let sheets;
      try {
        sheets = await parseLessonPoolFile(req.file.buffer, req.file.originalname);
      } catch (err) {
        throw httpError(400, `Dosya okunamadı: ${err.message}`);
      }
      if (!sheets.length) {
        throw httpError(
          400,
          'Dosyada haftalık ders çizelgesi bulunamadı. Tabloda sınıf seviyelerinin (9, 10, 11, 12 veya Hazırlık) yazdığı bir başlık satırı olmalı.'
        );
      }
      res.json({ success: true, data: { file_name: req.file.originalname, sheets } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async list(req, res, next) {
    try {
      const rows = await LessonPoolTemplate.findAll({ order: [['name', 'ASC']] });
      res.json({ success: true, data: rows.map(summary) });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await LessonPoolTemplate.findByPk(Number(req.params.id));
      if (!row) throw httpError(404, 'Ders havuzu bulunamadı');
      res.json({ success: true, data: row });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async create(req, res, next) {
    try {
      const row = await LessonPoolTemplate.create({ ...payloadFrom(req.validatedBody), created_by: req.user.user_id || null });
      await audit.log(req, {
        action: 'create',
        entityType: 'lesson_pool_template',
        entityId: row.id,
        summary: `Hazır ders havuzu oluşturuldu: ${row.name} (${row.items.length} ders)`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await LessonPoolTemplate.findByPk(Number(req.params.id));
      if (!row) throw httpError(404, 'Ders havuzu bulunamadı');
      const body = req.validatedBody;
      // Yalnız aktif/pasif değişimi gibi kısmi güncellemeler de desteklenir.
      const patch = body.items ? payloadFrom({ ...row.toJSON(), ...body }) : body;
      await row.update(patch);
      res.json({ success: true, data: row });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await LessonPoolTemplate.findByPk(Number(req.params.id));
      if (!row) throw httpError(404, 'Ders havuzu bulunamadı');
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'lesson_pool_template',
        entityId: row.id,
        summary: `Hazır ders havuzu silindi: ${row.name}`,
      });
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },
};
