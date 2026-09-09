const Joi = require('joi');

const createNormPositionSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  title_branch: Joi.string().required().max(100),
  quota_count: Joi.number().integer().min(0).max(1000).required(),
  notes: Joi.string().allow('', null).max(255),
});

const updateNormPositionSchema = createNormPositionSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  title_branch: Joi.string().optional().max(100),
  quota_count: Joi.number().integer().min(0).max(1000).optional(),
});

module.exports = { createNormPositionSchema, updateNormPositionSchema };
