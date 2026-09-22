const Joi = require('joi');
const { SCHOOL_CODE_PATTERN, SCHOOL_CODE_MESSAGE } = require('../utils/schoolCode');

const SCHOOL_TYPES = ['ilkokul', 'ortaokul', 'lise'];

const schoolCodeSchema = Joi.string().trim().pattern(SCHOOL_CODE_PATTERN).messages({
  'string.pattern.base': SCHOOL_CODE_MESSAGE,
});

const optionalId = Joi.number().integer().allow(null).empty('');

const createSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().min(2).max(200),
  code: schoolCodeSchema.empty('').optional(),
  school_type: Joi.string().valid(...SCHOOL_TYPES).default('lise'),
  daily_period_count: Joi.number().integer().min(1).max(12).default(8),
  province_id: optionalId,
  district_id: optionalId,
  directory_school_id: optionalId,
  meta: Joi.object().optional()
});

const updateSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  name: Joi.string().min(2).max(200),
  code: schoolCodeSchema,
  school_type: Joi.string().valid(...SCHOOL_TYPES),
  daily_period_count: Joi.number().integer().min(1).max(12),
  province_id: optionalId,
  district_id: optionalId,
  directory_school_id: optionalId,
  meta: Joi.object().optional()
}).min(1);

module.exports = { createSchoolSchema, updateSchoolSchema, SCHOOL_TYPES, schoolCodeSchema };
