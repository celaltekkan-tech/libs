const Joi = require('joi');

const createTeacherSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  city: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  personnel_no: Joi.string().allow('', null),
  national_id: Joi.string().allow('', null),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  last_graduated_school: Joi.string().allow('', null),
  class_level: Joi.string().allow('', null),
  title_branch: Joi.string().allow('', null),
  working_institution: Joi.string().allow('', null),
  degree: Joi.string().allow('', null),
  pension_degree: Joi.string().allow('', null),
  rank: Joi.string().allow('', null),
  degree_rank_date: Joi.date().allow(null),
  school_principal: Joi.string().allow('', null),
  annual_leave_quota: Joi.number().integer().min(0).max(365).allow(null),
  service_start_date: Joi.date().iso().allow(null),
  personnel_type: Joi.string().valid('ogretmen', 'memur', 'isci', 'typ').allow(null),
  contract_start_date: Joi.date().iso().allow(null),
  contract_end_date: Joi.date().iso().allow(null),
  meta: Joi.object().optional(),
});

const exportTeacherSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  columns: Joi.array().items(Joi.string()).min(1).optional(),
  filters: Joi.object({
    q: Joi.string().allow('').optional(),
    school_id: Joi.number().integer().optional(),
  }).optional(),
});

module.exports = { createTeacherSchema, exportTeacherSchema };