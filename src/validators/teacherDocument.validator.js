const Joi = require('joi');

const DOC_TYPES = [
  'yillik_plan',
  'zumre_tutanagi',
  'sinif_rehberlik_plani',
  'kulup_raporu',
  'maarif_modeli_raporu',
  'ogrenci_gelisim_raporu',
  'diger',
];
const STATUSES = ['taslak', 'teslim_edildi', 'onaylandi', 'revizyon_istendi'];

const createDocumentSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().required(),
  doc_type: Joi.string()
    .valid(...DOC_TYPES)
    .required(),
  title: Joi.string().required().max(150),
  academic_year: Joi.string().allow('', null).max(20),
  content: Joi.string().allow('', null).max(20000),
});

const updateDocumentSchema = Joi.object({
  title: Joi.string().optional().max(150),
  academic_year: Joi.string().allow('', null).max(20),
  content: Joi.string().allow('', null).max(20000),
}).min(1);

const reviewDocumentSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .required(),
  reviewer_note: Joi.string().allow('', null).max(255),
});

const duplicateDocumentSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  academic_year: Joi.string().required().max(20),
});

module.exports = {
  createDocumentSchema,
  updateDocumentSchema,
  reviewDocumentSchema,
  duplicateDocumentSchema,
  DOC_TYPES,
  STATUSES,
};
