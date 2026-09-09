const Joi = require('joi');

const SANCTION_LEVELS = [
  'uyari',
  'kinama',
  'okuldan_kisa_sureli_uzaklastirma',
  'okuldan_uzun_sureli_uzaklastirma',
  'okul_degistirme',
];
const STATUSES = ['acik', 'karara_baglandi', 'itiraz', 'kapandi'];

const createCaseSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  student_id: Joi.number().integer().required(),
  incident_date: Joi.date().iso().required(),
  description: Joi.string().required().max(2000),
  sanction_level: Joi.string()
    .valid(...SANCTION_LEVELS)
    .allow(null),
  notes: Joi.string().allow('', null).max(500),
});

const updateCaseSchema = Joi.object({
  tenant_id: Joi.number().integer().optional(),
  incident_date: Joi.date().iso().optional(),
  description: Joi.string().optional().max(2000),
  sanction_level: Joi.string()
    .valid(...SANCTION_LEVELS)
    .allow(null),
  status: Joi.string()
    .valid(...STATUSES)
    .optional(),
  decision_date: Joi.date().iso().allow(null),
  decision_summary: Joi.string().allow('', null).max(2000),
  notes: Joi.string().allow('', null).max(500),
}).min(1);

module.exports = { createCaseSchema, updateCaseSchema, SANCTION_LEVELS, STATUSES };
