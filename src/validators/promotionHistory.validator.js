const Joi = require('joi');

const applyPromotionSchema = Joi.object({
  new_degree: Joi.string().trim().required(),
  new_rank: Joi.string().trim().required(),
  new_degree_rank_date: Joi.date().iso().required(),
  note: Joi.string().trim().allow('', null).max(500),
});

module.exports = { applyPromotionSchema };
