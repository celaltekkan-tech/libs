const Joi = require('joi');

const ABSENCE_TYPES = ['mazeretsiz', 'mazeretli', 'raporlu', 'yarim_gun'];

const bulkAbsenceSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  absence_date: Joi.date().iso().required(),
  entries: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().required(),
        absence_type: Joi.string()
          .valid(...ABSENCE_TYPES)
          .required(),
        reason: Joi.string().allow('', null).max(255),
      })
    )
    .min(1)
    .required(),
});

const exportAbsenceSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

module.exports = { bulkAbsenceSchema, exportAbsenceSchema, ABSENCE_TYPES };
