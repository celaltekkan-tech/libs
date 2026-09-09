const Joi = require('joi');

const bulkAbsenceSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  absence_date: Joi.date().iso().required(),
  student_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  is_excused: Joi.boolean().allow(null),
  reason: Joi.string().allow('', null).max(255),
});

const exportAbsenceSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

module.exports = { bulkAbsenceSchema, exportAbsenceSchema };
