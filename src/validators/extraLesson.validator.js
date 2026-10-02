const Joi = require('joi');

const CATEGORIES = [
  'ders_yuku',
  'nobet',
  'dyk',
  'egzersiz',
  'sinav_gorevi',
  'belletici',
  'hazirlik_planlama',
  'kesinti',
  'diger',
];

const createExtraLessonSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .required(),
  hours: Joi.number().min(-500).max(500).required(),
  notes: Joi.string().allow('', null).max(255),
});

const updateExtraLessonSchema = createExtraLessonSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  teacher_id: Joi.number().integer().optional(),
  year: Joi.number().integer().min(2000).max(2100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .optional(),
  hours: Joi.number().min(-500).max(500).optional(),
});

const exportExtraLessonSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  year: Joi.number().integer().optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
});

const ABSENCE_REASONS = ['rapor', 'izin', 'gorev', 'mazeret', 'devamsiz', 'kismi'];

const upsertExtraLessonAbsenceSchema = Joi.object({
  teacher_id: Joi.number().integer().required(),
  absence_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  reason: Joi.string().valid(...ABSENCE_REASONS).required(),
  missed_hours: Joi.number().min(0.5).max(14).allow(null),
  note: Joi.string().trim().max(300).allow('', null),
});

module.exports = {
  createExtraLessonSchema,
  updateExtraLessonSchema,
  exportExtraLessonSchema,
  upsertExtraLessonAbsenceSchema,
  CATEGORIES,
  ABSENCE_REASONS,
};
