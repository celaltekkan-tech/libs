const Joi = require('joi');

const LEAVE_TYPES = ['yillik', 'mazeret', 'rapor', 'ucretsiz'];

const createLeaveSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().required(),
  leave_type: Joi.string()
    .valid(...LEAVE_TYPES)
    .required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
  reason: Joi.string().allow('', null).max(255),
});

const updateLeaveSchema = createLeaveSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  teacher_id: Joi.number().integer().optional(),
  leave_type: Joi.string()
    .valid(...LEAVE_TYPES)
    .optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

const exportLeaveSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).optional(),
  filters: Joi.object({
    teacher_id: Joi.number().integer().optional(),
    leave_type: Joi.string()
      .valid(...LEAVE_TYPES)
      .optional(),
    year: Joi.number().integer().optional(),
  }).optional(),
});

module.exports = { createLeaveSchema, updateLeaveSchema, exportLeaveSchema, LEAVE_TYPES };
