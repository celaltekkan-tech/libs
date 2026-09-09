const Joi = require('joi');

const ENTITY_TYPES = ['students'];

const createExportTemplateSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  entity_type: Joi.string()
    .valid(...ENTITY_TYPES)
    .required(),
  name: Joi.string().required().max(100),
  columns: Joi.array().items(Joi.string()).min(1).required(),
  filters: Joi.object().optional(),
});

module.exports = { createExportTemplateSchema, ENTITY_TYPES };
