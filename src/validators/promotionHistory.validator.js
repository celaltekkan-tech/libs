const Joi = require('joi');

const PROMOTION_TYPES = ['yillik', 'sekiz_yil', 'kariyer', 'manuel'];

const applyPromotionSchema = Joi.object({
  new_degree: Joi.string().trim().required(),
  new_rank: Joi.string().trim().required(),
  new_degree_rank_date: Joi.date().iso().required(),
  note: Joi.string().trim().allow('', null).max(500),
  type: Joi.string().valid(...PROMOTION_TYPES).default('manuel'),
  override_reason: Joi.string()
    .trim()
    .max(500)
    .when('type', { is: 'manuel', then: Joi.required(), otherwise: Joi.allow('', null) }),
  is_permanent: Joi.boolean().default(true),
});

const acknowledgePromotionSchema = Joi.object({
  degree_rank_date: Joi.date().iso().required(),
});

const reportEightYearCheckSchema = Joi.object({
  has_penalty: Joi.boolean().required(),
  penalty_date: Joi.date().iso().when('has_penalty', { is: true, then: Joi.required(), otherwise: Joi.allow(null) }),
  note: Joi.string().trim().allow('', null).max(500),
});

module.exports = {
  applyPromotionSchema,
  acknowledgePromotionSchema,
  reportEightYearCheckSchema,
  PROMOTION_TYPES,
};
