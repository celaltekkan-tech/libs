const Joi = require('joi');

const REGISTRATION_STATUSES = ['aktif', 'nakil_gelen', 'nakil_giden', 'kayit_silindi'];

const extraContactSchema = Joi.object({
  label: Joi.string().allow('', null).max(100),
  phone: Joi.string().allow('', null).max(50),
  address: Joi.string().allow('', null).max(500),
  description: Joi.string().allow('', null).max(500),
}).or('label', 'phone', 'address', 'description');

const createStudentSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  classroom_id: Joi.number().integer().required(),
  student_number: Joi.string().required().max(50),
  national_id: Joi.string().allow('', null),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  gender: Joi.string().valid('K', 'E', '', null).allow(null),
  birth_date: Joi.date().iso().allow(null),
  registration_status: Joi.string()
    .valid(...REGISTRATION_STATUSES)
    .allow(null),
  parent_name: Joi.string().allow('', null),
  parent_phone: Joi.string().allow('', null),
  extra_contacts: Joi.array().items(extraContactSchema).max(20).optional(),
  is_inclusion: Joi.boolean().allow(null),
  is_foreign: Joi.boolean().allow(null),
  meta: Joi.object().optional(),
});

const updateStudentSchema = createStudentSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  classroom_id: Joi.number().integer().optional(),
  student_number: Joi.string().optional().max(50),
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
});

const exportStudentSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).required(),
  filters: Joi.object({
    q: Joi.string().allow('').optional(),
    school_id: Joi.number().integer().optional(),
    classroom_id: Joi.number().integer().optional(),
    class_level: Joi.string().allow('').optional(),
    section: Joi.string().allow('').optional(),
    gender: Joi.string().valid('K', 'E').optional(),
    registration_status: Joi.string()
      .valid(...REGISTRATION_STATUSES)
      .optional(),
  }).optional(),
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  exportStudentSchema,
  REGISTRATION_STATUSES,
};
