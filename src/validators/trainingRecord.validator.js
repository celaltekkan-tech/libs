const Joi = require('joi');

const createTrainingSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().required(),
  title: Joi.string().required().max(150),
  institution: Joi.string().allow('', null).max(150),
  start_date: Joi.date().iso().allow(null),
  end_date: Joi.date().iso().allow(null),
  hours: Joi.number().integer().min(0).max(2000).allow(null),
  certificate_no: Joi.string().allow('', null).max(50),
  notes: Joi.string().allow('', null).max(255),
});

const updateTrainingSchema = createTrainingSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  teacher_id: Joi.number().integer().optional(),
  title: Joi.string().optional().max(150),
});

module.exports = { createTrainingSchema, updateTrainingSchema };
