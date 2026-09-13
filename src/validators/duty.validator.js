const Joi = require('joi');

const createDutyLocationSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  name: Joi.string().required().max(100),
  floor_level: Joi.number().integer().min(0).max(50).allow(null),
  sort_order: Joi.number().integer().min(0).max(1000).allow(null),
  is_active: Joi.boolean().allow(null),
});

const updateDutyLocationSchema = createDutyLocationSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  name: Joi.string().optional().max(100),
});

const createDutyAssignmentSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  teacher_id: Joi.number().integer().required(),
  duty_location_id: Joi.number().integer().required(),
  duty_date: Joi.date().iso().required(),
  notes: Joi.string().allow('', null).max(255),
});

const updateDutyAssignmentSchema = Joi.object({
  tenant_id: Joi.number().integer().optional(),
  teacher_id: Joi.number().integer().optional(),
  duty_location_id: Joi.number().integer().optional(),
  duty_date: Joi.date().iso().optional(),
  notes: Joi.string().allow('', null).max(255),
  incident_note: Joi.string().allow('', null).max(2000),
}).min(1);

const generateDutySchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
  duty_location_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  include_weekends: Joi.boolean().allow(null),
  /** fair = adil dağıtım; weekly_rotate = kat kaydırma */
  mode: Joi.string().valid('fair', 'weekly_rotate').default('fair'),
});

const exportDutySchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

module.exports = {
  createDutyLocationSchema,
  updateDutyLocationSchema,
  createDutyAssignmentSchema,
  updateDutyAssignmentSchema,
  generateDutySchema,
  exportDutySchema,
};
