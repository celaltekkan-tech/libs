'use strict';

const Joi = require('joi');

const createRoleSchema = Joi.object({
  role_name: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().allow('', null).max(255),
  permission_keys: Joi.array().items(Joi.string().max(80)).default([]),
  clone_from_role_id: Joi.number().integer().allow(null),
});

const updateRoleSchema = Joi.object({
  role_name: Joi.string().trim().min(2).max(80),
  description: Joi.string().allow('', null).max(255),
  permission_keys: Joi.array().items(Joi.string().max(80)),
}).min(1);

module.exports = { createRoleSchema, updateRoleSchema };
