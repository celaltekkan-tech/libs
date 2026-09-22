const Joi = require('joi');

const createRegulationArticleSchema = Joi.object({
  article_no: Joi.string().trim().allow('', null).max(60),
  title: Joi.string().trim().required(),
  description: Joi.string().trim().allow('', null).max(2000),
  default_sanction_type: Joi.string().trim().allow('', null).max(60),
});

module.exports = { createRegulationArticleSchema };
