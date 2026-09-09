const Joi = require('joi');

const createLicenseSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  plan: Joi.string().trim().min(2).max(100).required(),
  starts_at: Joi.date().optional(),
  ends_at: Joi.date().allow(null).optional(),
  notes: Joi.string().allow('', null).max(1000).optional(),
});

module.exports = { createLicenseSchema };
