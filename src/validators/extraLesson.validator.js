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

module.exports = { createExtraLessonSchema, updateExtraLessonSchema, exportExtraLessonSchema, CATEGORIES };
