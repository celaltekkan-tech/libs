const Joi = require('joi');

const createClassHourSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().required(),
  class_level: Joi.string().required().max(20),
  weekly_hours: Joi.number().integer().min(0).max(60).required(),
});

const updateClassHourSchema = Joi.object({
  weekly_hours: Joi.number().integer().min(0).max(60).required(),
});

module.exports = { createClassHourSchema, updateClassHourSchema };
