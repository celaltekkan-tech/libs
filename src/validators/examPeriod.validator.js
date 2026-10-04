const Joi = require('joi');

const createExamPeriodSchema = Joi.object({
  label: Joi.string().trim().allow('', null).max(80),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  exam_type: Joi.string().valid('ortak', 'sorumluluk').default('ortak'),
});

const updateExamPeriodSchema = Joi.object({
  label: Joi.string().trim().allow('', null).max(80),
  start_date: Joi.date().iso(),
  end_date: Joi.date().iso(),
  is_active: Joi.boolean(),
});

module.exports = { createExamPeriodSchema, updateExamPeriodSchema };
