const Joi = require('joi');

const EXAM_TYPES = ['yazili', 'ortak', 'telafi', 'sorumluluk'];

const createExamSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  classroom_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().required(),
  exam_type: Joi.string()
    .valid(...EXAM_TYPES)
    .required(),
  exam_date: Joi.date().iso().required(),
  start_time: Joi.string().allow('', null).max(10),
  duration_minutes: Joi.number().integer().min(1).max(600).allow(null),
  notes: Joi.string().allow('', null).max(255),
});

const updateExamSchema = createExamSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  classroom_id: Joi.number().integer().optional(),
  subject_id: Joi.number().integer().optional(),
  exam_type: Joi.string()
    .valid(...EXAM_TYPES)
    .optional(),
  exam_date: Joi.date().iso().optional(),
});

const exportExamSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

module.exports = { createExamSchema, updateExamSchema, exportExamSchema, EXAM_TYPES };
