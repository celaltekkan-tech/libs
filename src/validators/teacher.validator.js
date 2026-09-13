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
  union_name: Joi.string().trim().allow('', null).max(150),
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

const mebbisImportRowSchema = Joi.object({
  row_index: Joi.number().integer().optional(),
  il_ilce: Joi.string().allow('', null),
  kurum_adi: Joi.string().allow('', null),
  kurum_kodu: Joi.string().allow('', null),
  kurum_baslama_tarihi: Joi.date().iso().allow('', null),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  national_id: Joi.string().allow('', null),
  unvan: Joi.string().allow('', null),
  gorev: Joi.string().allow('', null),
  brans: Joi.string().allow('', null),
  seviye_unvani: Joi.string().allow('', null),
  personnel_type: Joi.string().valid('ogretmen', 'memur', 'isci', 'typ').allow('', null),
  ogrenim_durumu: Joi.string().allow('', null),
  kurum_sicil_no: Joi.string().allow('', null),
  emekli_sicil_no: Joi.string().allow('', null),
  arsiv_no: Joi.string().allow('', null),
  cinsiyet: Joi.string().allow('', null),
  kan_grubu: Joi.string().allow('', null),
  dogum_tarihi: Joi.date().iso().allow('', null),
  ilk_gorev_tarihi: Joi.date().iso().allow('', null),
  durum: Joi.string().allow('', null),
  kademe: Joi.number().integer().allow(null),
  derece: Joi.number().integer().allow(null),
  matched_teacher_id: Joi.number().integer().allow(null),
  union_name: Joi.string().trim().allow('', null).max(150),
  include: Joi.boolean().optional(),
});

const importMebbisCommitSchema = Joi.object({
  school_id: Joi.number().integer().required(),
  rows: Joi.array().items(mebbisImportRowSchema).min(1).required(),
});

module.exports = { createTeacherSchema, exportTeacherSchema, importMebbisCommitSchema };