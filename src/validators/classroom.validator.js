const Joi = require('joi');

const createClassroomSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  class_level: Joi.string().required().max(20),
  section: Joi.string().required().max(20),
  teacher_id: Joi.number().integer().allow(null),
  academic_year: Joi.string().allow('', null).max(20),
  is_active: Joi.boolean().allow(null),
});

const updateClassroomSchema = createClassroomSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  class_level: Joi.string().optional().max(20),
  section: Joi.string().optional().max(20),
});

const exportClassroomSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).optional(),
  filters: Joi.object({
    q: Joi.string().allow('').optional(),
    school_id: Joi.number().integer().optional(),
    is_active: Joi.boolean().optional(),
  }).optional(),
});

module.exports = { createClassroomSchema, updateClassroomSchema, exportClassroomSchema };
