const Joi = require('joi');

const REGISTRATION_STATUSES = ['aktif', 'nakil_giden', 'orgun_egitim_disi'];
const BOARDING_STATUSES = ['Yatılı', 'Gündüzlü'];

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
  national_id: Joi.string()
    .allow('', null)
    .custom((value, helpers) => {
      if (value == null || value === '') return null;
      let s = String(value).trim();
      if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
      const digits = s.replace(/\D/g, '');
      if (!/^\d{11}$/.test(digits)) {
        return helpers.error('any.custom');
      }
      return digits;
    })
    .messages({
      'any.custom': 'T.C. kimlik no 11 haneli sayı olmalıdır',
    }),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  gender: Joi.string().valid('K', 'E', '', null).allow(null),
  birth_date: Joi.date().iso().allow(null),
  yasi: Joi.number().integer().min(0).max(120).allow(null),
  registration_status: Joi.string()
    .valid(...REGISTRATION_STATUSES)
    .allow(null),
  parent_name: Joi.string().allow('', null),
  mother_name: Joi.string().allow('', null),
  father_name: Joi.string().allow('', null),
  parent_phone: Joi.string().allow('', null),
  student_phone: Joi.string().allow('', null).max(50),
  extra_contacts: Joi.array().items(extraContactSchema).max(20).optional(),
  is_inclusion: Joi.boolean().allow(null),
  is_foreign: Joi.boolean().allow(null),
  boarding_status: Joi.string()
    .valid(...BOARDING_STATUSES, '')
    .allow(null),
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
    yasi: Joi.number().integer().min(0).max(120).optional(),
    registration_status: Joi.string()
      .valid(...REGISTRATION_STATUSES)
      .optional(),
    boarding_status: Joi.string()
      .valid(...BOARDING_STATUSES)
      .optional(),
  }).optional(),
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  exportStudentSchema,
  REGISTRATION_STATUSES,
  BOARDING_STATUSES,
};
