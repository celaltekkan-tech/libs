const Joi = require('joi');

const CHANNELS = ['sms', 'email', 'both'];
const TARGET_TYPES = ['all', 'classroom', 'class_level', 'student'];

const createAnnouncementSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  title: Joi.string().required().max(150),
  body: Joi.string().required().max(2000),
  channel: Joi.string()
    .valid(...CHANNELS)
    .required(),
  target_type: Joi.string()
    .valid(...TARGET_TYPES)
    .required(),
  // classroom/student hedeflerinde sayısal id, class_level hedefinde sınıf
  // etiketi (ör. "9") beklenir. String önce denenir; aksi halde Joi "9" gibi
  // sayısal görünen string'leri number'a çevirip class_level karşılaştırmasını bozar.
  target_ids: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number().integer())).optional(),
});

module.exports = { createAnnouncementSchema, CHANNELS, TARGET_TYPES };
