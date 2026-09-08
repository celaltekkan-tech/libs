const Joi = require('joi');

const createSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().min(2).max(200),
  code: Joi.string().required().min(2).max(50),
  meta: Joi.object().optional()
});

const updateSchoolSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  name: Joi.string().min(2).max(200),
  code: Joi.string().min(2).max(50),
  meta: Joi.object().optional()
}).min(1);

module.exports = { createSchoolSchema, updateSchoolSchema };

