const Joi = require('joi');

const createLicenseSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  plan: Joi.string().trim().min(2).max(100).required(),
  starts_at: Joi.date().optional(),
  ends_at: Joi.date().allow(null).optional(),
  notes: Joi.string().allow('', null).max(1000).optional(),
  sms_quota: Joi.number().integer().min(1).max(10000000).allow(null).optional(),
  ai_daily_limit: Joi.number().integer().min(0).max(100000).allow(null).optional(),
});

const updateAiLimitSchema = Joi.object({
  ai_daily_limit: Joi.number().integer().min(0).max(100000).allow(null).required(),
});

module.exports = { createLicenseSchema, updateAiLimitSchema };
