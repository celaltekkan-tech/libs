const Joi = require('joi');

const sendSmsTestSchema = Joi.object({
  phone: Joi.string().trim().min(10).max(20).required(),
  message: Joi.string().trim().min(1).max(900).required(),
});

module.exports = { sendSmsTestSchema };
