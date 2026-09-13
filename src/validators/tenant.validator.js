const Joi = require('joi');
const { SCHOOL_TYPES } = require('./school.validator');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const createTenantWizardSchema = Joi.object({
  tenant: Joi.object({
    name: Joi.string().required().min(2).max(200),
    plan: Joi.string().optional().max(50),
  }).required(),
  school: Joi.object({
    name: Joi.string().required().min(2).max(200),
    code: Joi.string().required().min(2).max(50),
    school_type: Joi.string().valid(...SCHOOL_TYPES).default('lise'),
  }).required(),
  admin: Joi.object({
    full_name: Joi.string().required().min(2).max(100),
    email: email.required(),
    password: Joi.string().required().min(8).max(100),
  }).required(),
});

const updateTenantSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  plan: Joi.string().max(50).allow(null, ''),
  is_active: Joi.boolean(),
  two_factor_enabled: Joi.boolean(),
}).min(1);

module.exports = { createTenantWizardSchema, updateTenantSchema };
