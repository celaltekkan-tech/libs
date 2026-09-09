const Joi = require('joi');

const DAY_MIN = 1;
const DAY_MAX = 6; // 1=Pazartesi ... 6=Cumartesi

const createScheduleEntrySchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  classroom_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().allow(null),
  day_of_week: Joi.number().integer().min(DAY_MIN).max(DAY_MAX).required(),
  period_no: Joi.number().integer().min(1).max(12).required(),
  academic_year: Joi.string().allow('', null).max(20),
});

const updateScheduleEntrySchema = createScheduleEntrySchema.keys({
  tenant_id: Joi.number().integer().optional(),
  classroom_id: Joi.number().integer().optional(),
  subject_id: Joi.number().integer().optional(),
  day_of_week: Joi.number().integer().min(DAY_MIN).max(DAY_MAX).optional(),
  period_no: Joi.number().integer().min(1).max(12).optional(),
});

const exportScheduleSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).optional(),
  filters: Joi.object({
    classroom_id: Joi.number().integer().optional(),
    teacher_id: Joi.number().integer().optional(),
    school_id: Joi.number().integer().optional(),
    academic_year: Joi.string().allow('').optional(),
  }).optional(),
});

module.exports = {
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  exportScheduleSchema,
  DAY_MIN,
  DAY_MAX,
};
