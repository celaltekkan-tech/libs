const Joi = require('joi');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const createUserSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  full_name: Joi.string().required().min(2).max(100),
  email: email.required(),
  password: Joi.string().required().min(8).max(100),
  role: Joi.string().valid('admin', 'supervisor', 'teacher', 'user').default('teacher'),
  is_active: Joi.boolean()
});

const updateUserSchema = Joi.object({
  tenant_id: Joi.number().integer(),
  school_id: Joi.number().integer().allow(null),
  full_name: Joi.string().min(2).max(100),
  email,
  password: Joi.string().min(8).max(100),
  role: Joi.string().valid('admin', 'supervisor', 'teacher', 'user'),
  is_active: Joi.boolean()
}).min(1);

module.exports = { createUserSchema, updateUserSchema };

