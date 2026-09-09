const Joi = require('joi');

const createAcademicYearSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  label: Joi.string().required().max(20),
  start_date: Joi.date().iso().allow(null),
  end_date: Joi.date().iso().allow(null),
  is_current: Joi.boolean().allow(null),
});

const updateAcademicYearSchema = createAcademicYearSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  label: Joi.string().optional().max(20),
});

module.exports = { createAcademicYearSchema, updateAcademicYearSchema };
