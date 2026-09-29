const Joi = require('joi');

const id = Joi.number().integer().positive();
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, '');

const businessSchema = Joi.object({
  school_id: id.required(),
  name: Joi.string().trim().max(200).required(),
  tax_no: Joi.string().trim().allow('', null).max(20),
  sgk_workplace_no: Joi.string().trim().allow('', null).max(40),
  address: Joi.string().trim().allow('', null).max(500),
  phone: Joi.string().trim().allow('', null).max(30),
  field_name: Joi.string().trim().allow('', null).max(120),
  master_name: Joi.string().trim().allow('', null).max(120),
  contact_name: Joi.string().trim().allow('', null).max(120),
  is_active: Joi.boolean(),
});

const updateBusinessSchema = businessSchema.fork(['school_id', 'name'], (s) => s.optional()).min(1);

const placementSchema = Joi.object({
  school_id: id.required(),
  student_id: id.required(),
  business_id: id.required(),
  teacher_id: id.allow(null),
  academic_year: Joi.string().trim().allow('', null).max(20),
  start_date: day,
  end_date: day,
  weekly_days: Joi.number().integer().min(1).max(6).default(3),
  contract_no: Joi.string().trim().allow('', null).max(40),
  contract_date: day,
  status: Joi.string().valid('aktif', 'tamamlandi', 'ayrildi').default('aktif'),
  note: Joi.string().trim().allow('', null).max(1000),
});

const updatePlacementSchema = placementSchema.fork(['school_id', 'student_id', 'business_id'], (s) => s.optional()).min(1);

const supportSchema = Joi.object({
  work_days: Joi.number().integer().min(0).max(31),
  amount: Joi.number().min(0).max(1000000).allow(null),
  status: Joi.string().valid('bekliyor', 'odendi'),
  paid_at: day,
  note: Joi.string().trim().allow('', null).max(500),
}).min(1);

const generateSupportSchema = Joi.object({
  school_id: id.required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
});

const sgkSchema = Joi.object({
  notice_date: day,
  sgk_ref: Joi.string().trim().allow('', null).max(60),
  status: Joi.string().valid('taslak', 'bildirildi'),
  note: Joi.string().trim().allow('', null).max(500),
}).min(1);

const prepareSgkSchema = Joi.object({
  school_id: id.required(),
});

const documentSchema = Joi.object({
  school_id: id.required(),
  kind: Joi.string().valid('sozlesme', 'devam', 'destek', 'sgk').required(),
  placement_id: id,
  year: Joi.number().integer().min(2000).max(2100),
  month: Joi.number().integer().min(1).max(12),
});

module.exports = {
  businessSchema,
  updateBusinessSchema,
  placementSchema,
  updatePlacementSchema,
  supportSchema,
  generateSupportSchema,
  sgkSchema,
  prepareSgkSchema,
  documentSchema,
};
