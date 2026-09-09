const Joi = require('joi');

const createSubjectSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().max(100),
  code: Joi.string().allow('', null).max(20),
  difficulty_level: Joi.string().valid('kolay', 'orta', 'zor').allow(null),
  is_active: Joi.boolean().allow(null),
});

const updateSubjectSchema = createSubjectSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  name: Joi.string().optional().max(100),
});

const exportSubjectSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).optional(),
  filters: Joi.object({
    q: Joi.string().allow('').optional(),
    is_active: Joi.boolean().optional(),
  }).optional(),
});

module.exports = { createSubjectSchema, updateSubjectSchema, exportSubjectSchema };
