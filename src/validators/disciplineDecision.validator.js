const Joi = require('joi');

const SANCTION_TYPES = [
  'uyari',
  'kinama',
  'okuldan_kisa_sureli_uzaklastirma',
  'okuldan_uzun_sureli_uzaklastirma',
  'okul_degistirme',
];
const DECISION_STATUS_VALUES = ['taslak', 'onaylandi', 'itiraz_edildi', 'iptal'];
const NOTIFICATION_TYPES = ['ogrenciye_ceza_bildirimi', 'veliye_bildirim', 'ceza_gunu_bildirimi'];

const createDecisionSchema = Joi.object({
  participant_id: Joi.number().integer().required(),
  decision_no: Joi.string().trim().allow('', null).max(120),
  decision_date: Joi.date().iso().allow(null),
  prior_sanctions_summary: Joi.string().trim().allow('', null).max(2000),
  behavior_date: Joi.date().iso().allow(null),
  behavior_place: Joi.string().trim().allow('', null).max(255),
  behavior_type: Joi.string().trim().allow('', null).max(255),
  behavior_reason: Joi.string().trim().allow('', null).max(2000),
  statements_summary: Joi.string().trim().allow('', null).max(4000),
  mitigating_aggravating_factors: Joi.string().trim().allow('', null).max(2000),
  board_opinion: Joi.string().trim().allow('', null).max(2000),
  regulation_article_id: Joi.number().integer().allow(null),
  regulation_article_text: Joi.string().trim().allow('', null).max(500),
  sanction_type: Joi.string()
    .valid(...SANCTION_TYPES)
    .allow(null),
  sanction_days: Joi.number().integer().min(0).allow(null),
  board_members: Joi.array().items(Joi.object({ name: Joi.string().allow(''), title: Joi.string().allow('') })).default([]),
  board_decision: Joi.string().trim().allow('', null).max(2000),
  approved_by: Joi.string().trim().allow('', null).max(255),
  approved_date: Joi.date().iso().allow(null),
  status: Joi.string().valid(...DECISION_STATUS_VALUES),
});

const updateDecisionSchema = createDecisionSchema.fork(['participant_id'], (s) => s.optional());

const createNotificationSchema = Joi.object({
  participant_id: Joi.number().integer().required(),
  notification_type: Joi.string()
    .valid(...NOTIFICATION_TYPES)
    .required(),
  sent_date: Joi.date().iso().allow(null),
  sanction_start_date: Joi.date().iso().allow(null),
  sanction_end_date: Joi.date().iso().allow(null),
  broken_behavior_point: Joi.number().integer().allow(null),
  remaining_behavior_point: Joi.number().integer().allow(null),
  acknowledged_by: Joi.string().trim().allow('', null).max(255),
  acknowledged_date: Joi.date().iso().allow(null),
});

module.exports = {
  SANCTION_TYPES,
  DECISION_STATUS_VALUES,
  NOTIFICATION_TYPES,
  createDecisionSchema,
  updateDecisionSchema,
  createNotificationSchema,
};
