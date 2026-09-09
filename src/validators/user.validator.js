const Joi = require('joi');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const SCHOOL_ROLES = ['Müdür', 'Müdür Yardımcısı', 'Memur', 'Öğretmen', 'Rehber Öğretmen'];

const createUserSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().required(),
  school_role: Joi.string()
    .valid(...SCHOOL_ROLES)
    .required(),
  full_name: Joi.string().required().min(2).max(100),
  email: email.required(),
  password: Joi.string().required().min(8).max(100),
  is_active: Joi.boolean(),
});

const updateUserSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  school_id: Joi.number().integer().required(),
  school_role: Joi.string()
    .valid(...SCHOOL_ROLES)
    .required(),
  full_name: Joi.string().min(2).max(100),
  email,
  password: Joi.string().min(8).max(100),
  is_active: Joi.boolean(),
}).min(1);

module.exports = { createUserSchema, updateUserSchema, SCHOOL_ROLES };
