const Joi = require('joi');

const createPersonnelCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
});

const updatePersonnelCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).optional(),
  sort_order: Joi.number().integer().min(0).max(9999).optional(),
});

module.exports = { createPersonnelCategorySchema, updatePersonnelCategorySchema };
