const Joi = require('joi');

const FEEDBACK_STATUSES = ['new', 'read', 'resolved'];

const createFeedbackSchema = Joi.object({
  message: Joi.string().trim().min(5).max(2000).required(),
});

const updateFeedbackSchema = Joi.object({
  status: Joi.string()
    .valid(...FEEDBACK_STATUSES)
    .required(),
});

module.exports = { createFeedbackSchema, updateFeedbackSchema, FEEDBACK_STATUSES };
