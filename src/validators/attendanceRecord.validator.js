const Joi = require('joi');

const STATUSES = ['geldi', 'gelmedi', 'izinli', 'raporlu', 'fazla_mesai'];

const bulkAttendanceSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  attendance_date: Joi.date().iso().required(),
  entries: Joi.array()
    .items(
      Joi.object({
        teacher_id: Joi.number().integer().required(),
        status: Joi.string()
          .valid(...STATUSES)
          .required(),
        overtime_hours: Joi.number().min(0).max(24).allow(null),
        notes: Joi.string().allow('', null).max(255),
      })
    )
    .min(1)
    .required(),
});

const exportAttendanceSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  year: Joi.number().integer().optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
});

module.exports = {
  bulkAttendanceSchema,
  exportAttendanceSchema,
  STATUSES,
};
