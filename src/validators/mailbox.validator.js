const Joi = require('joi');

const sendMailboxSchema = Joi.object({
  to: Joi.string().trim().min(3).max(500).required(),
  cc: Joi.string().trim().max(500).allow('', null),
  subject: Joi.string().trim().min(1).max(500).required(),
  text: Joi.string().trim().min(1).max(100000).required(),
});

const seenMailboxSchema = Joi.object({
  seen: Joi.boolean().required(),
  folder: Joi.string().trim().max(200).allow('', null),
});

module.exports = { sendMailboxSchema, seenMailboxSchema };
