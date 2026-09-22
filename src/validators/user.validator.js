const Joi = require('joi');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const SCHOOL_ROLES = ['Müdür', 'Müdür Yardımcısı', 'Memur', 'Öğretmen', 'Rehber Öğretmen'];

const createUserSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().required(),
  role_id: Joi.number().integer(),
  school_role: Joi.string().max(80),
  full_name: Joi.string().required().min(2).max(100),
  email: email.required(),
  password: Joi.string().required().min(8).max(100),
  is_active: Joi.boolean(),
  phone: Joi.string().trim().max(30).allow('', null),
}).or('role_id', 'school_role');

const updateUserSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  school_id: Joi.number().integer().required(),
  role_id: Joi.number().integer(),
  school_role: Joi.string().max(80),
  full_name: Joi.string().min(2).max(100),
  email,
  password: Joi.string().min(8).max(100),
  is_active: Joi.boolean(),
  phone: Joi.string().trim().max(30).allow('', null),
})
  .or('role_id', 'school_role')
  .min(1);

module.exports = { createUserSchema, updateUserSchema, SCHOOL_ROLES };
