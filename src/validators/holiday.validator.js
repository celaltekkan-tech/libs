const Joi = require('joi');

const createHolidaySchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  name: Joi.string().required().max(150),
  month: Joi.number().integer().min(1).max(12).required(),
  day: Joi.number().integer().min(1).max(31).required(),
  year: Joi.number().integer().min(2000).max(2100).allow(null),
});

module.exports = { createHolidaySchema };
