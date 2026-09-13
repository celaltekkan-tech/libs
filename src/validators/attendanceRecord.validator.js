const Joi = require('joi');

const STATUSES = ['geldi', 'gelmedi', 'izinli', 'raporlu', 'fazla_mesai', 'mazeretli', 'is_kazasi'];

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
  year: Joi.number().integer().required(),
  month: Joi.number().integer().min(1).max(12).required(),
  /** Resmi tatil / hafta sonu dışında kapatılacak günler (1–31) */
  closed_days: Joi.array().items(Joi.number().integer().min(1).max(31)).optional(),
  typ_no: Joi.string().allow('', null).max(100).optional(),
  typ_subject: Joi.string().allow('', null).max(150).optional(),
  typ_start_date: Joi.string().allow('', null).max(40).optional(),
  typ_end_date: Joi.string().allow('', null).max(40).optional(),
  school_id: Joi.number().integer().optional(),
});

module.exports = {
  bulkAttendanceSchema,
  exportAttendanceSchema,
  STATUSES,
};
