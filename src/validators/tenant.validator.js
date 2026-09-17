const Joi = require('joi');
const { SCHOOL_TYPES } = require('./school.validator');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();
const phone = Joi.string().trim().max(30).allow('', null);

const createTenantWizardSchema = Joi.object({
  tenant: Joi.object({
    name: Joi.string().required().min(2).max(200),
    plan: Joi.string().optional().max(50),
    phone,
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
    phone: Joi.string().trim().max(30).required(),
  }).required(),
});

const updateTenantSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  plan: Joi.string().max(50).allow(null, ''),
  phone,
  is_active: Joi.boolean(),
  two_factor_enabled: Joi.boolean(),
  sms_login_enabled: Joi.boolean(),
}).min(1);

const updateTenantUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100),
  email,
  phone,
}).or('full_name', 'email', 'phone');

module.exports = { createTenantWizardSchema, updateTenantSchema, updateTenantUserSchema };
