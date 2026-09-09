const Joi = require('joi');

const CONSENT_TYPES = ['sms_bilgilendirme', 'eposta_bilgilendirme', 'fotograf_kullanim', 'diger'];

const upsertConsentSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  student_id: Joi.number().integer().required(),
  consent_type: Joi.string()
    .valid(...CONSENT_TYPES)
    .required(),
  granted: Joi.boolean().required(),
  notes: Joi.string().allow('', null).max(255),
});

module.exports = { upsertConsentSchema, CONSENT_TYPES };
