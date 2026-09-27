const Joi = require('joi');

const item = Joi.object({
  sort_order: Joi.number().integer().min(0),
  name: Joi.string().trim().max(100).required(),
  kind: Joi.string().valid('ortak', 'secmeli', 'rehberlik').required(),
  category: Joi.string().trim().allow('', null).max(100),
  max_takes: Joi.number().integer().min(1).max(20).allow(null),
  has_options: Joi.boolean(),
  hours: Joi.object().pattern(Joi.string().max(20), Joi.array().items(Joi.number().integer().min(1).max(40)).max(10)),
});

const base = {
  name: Joi.string().trim().max(150),
  school_type: Joi.string().valid('ilkokul', 'ortaokul', 'lise').allow(null, ''),
  levels: Joi.array().items(Joi.string().trim().max(20)).min(1).max(15).unique(),
  items: Joi.array().items(item).min(1).max(300),
  source_name: Joi.string().trim().allow('', null).max(255),
  note: Joi.string().trim().allow('', null).max(2000),
  is_active: Joi.boolean(),
};

const createTemplateSchema = Joi.object({
  ...base,
  name: base.name.required(),
  levels: base.levels.required(),
  items: base.items.required(),
});
const updateTemplateSchema = Joi.object(base).min(1);

// Okul tarafı: şablonu ders havuzuna aktarma.
const importTemplateSchema = Joi.object({
  template_id: Joi.number().integer().positive().required(),
  // { şablonSeviyesi: şubeSeviyesi }
  level_map: Joi.object().pattern(Joi.string().max(20), Joi.string().trim().max(20).allow('', null)).required(),
  mode: Joi.string().valid('merge', 'replace').default('merge'),
  kinds: Joi.array().items(Joi.string().valid('ortak', 'secmeli', 'rehberlik')).min(1).unique().default(['ortak', 'secmeli', 'rehberlik']),
  // { şablonDersAdı: okuldakiDersId | 0 (yeni ders aç) }
  subject_map: Joi.object().pattern(Joi.string().max(100), Joi.number().integer().min(0)),
});

module.exports = { createTemplateSchema, updateTemplateSchema, importTemplateSchema };
