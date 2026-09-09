const Joi = require('joi');

const SESSION_TYPES = ['bireysel', 'grup', 'veli_gorusmesi', 'yonlendirme'];
const REFERRAL_TARGETS = ['RAM', 'saglik_kurulusu', 'sosyal_hizmet'];

const createGuidanceSessionSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  student_id: Joi.number().integer().required(),
  session_date: Joi.date().iso().required(),
  session_type: Joi.string()
    .valid(...SESSION_TYPES)
    .required(),
  summary: Joi.string().required().max(3000),
  referral_to: Joi.string()
    .valid(...REFERRAL_TARGETS)
    .allow(null),
});

const updateGuidanceSessionSchema = createGuidanceSessionSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  student_id: Joi.number().integer().optional(),
  session_date: Joi.date().iso().optional(),
  session_type: Joi.string()
    .valid(...SESSION_TYPES)
    .optional(),
  summary: Joi.string().optional().max(3000),
});

module.exports = { createGuidanceSessionSchema, updateGuidanceSessionSchema, SESSION_TYPES, REFERRAL_TARGETS };
