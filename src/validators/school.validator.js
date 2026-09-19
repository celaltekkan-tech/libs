const Joi = require('joi');

const SCHOOL_TYPES = ['ilkokul', 'ortaokul', 'lise'];

const createSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().min(2).max(200),
  code: Joi.string().required().min(2).max(50),
  school_type: Joi.string().valid(...SCHOOL_TYPES).default('lise'),
  daily_period_count: Joi.number().integer().min(1).max(12).default(8),
  meta: Joi.object().optional()
});

const updateSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  name: Joi.string().min(2).max(200),
  code: Joi.string().min(2).max(50),
  school_type: Joi.string().valid(...SCHOOL_TYPES),
  daily_period_count: Joi.number().integer().min(1).max(12),
  meta: Joi.object().optional()
}).min(1);

module.exports = { createSchoolSchema, updateSchoolSchema, SCHOOL_TYPES };

