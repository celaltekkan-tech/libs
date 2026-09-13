const Joi = require('joi');

const singleDaySchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().max(150),
  month: Joi.number().integer().min(1).max(12).required(),
  day: Joi.number().integer().min(1).max(31).required(),
  year: Joi.number().integer().min(2000).max(2100).allow(null),
  recurring: Joi.forbidden(),
  start_date: Joi.forbidden(),
  end_date: Joi.forbidden(),
});

const rangeSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().max(150),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  recurring: Joi.boolean().default(false),
  month: Joi.forbidden(),
  day: Joi.forbidden(),
  year: Joi.forbidden(),
});

const createHolidaySchema = Joi.alternatives().try(rangeSchema, singleDaySchema);

module.exports = { createHolidaySchema };
