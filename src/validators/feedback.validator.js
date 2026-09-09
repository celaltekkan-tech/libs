const Joi = require('joi');

const FEEDBACK_STATUSES = ['new', 'read', 'resolved', 'cancelled'];
const PENDING_FEEDBACK_STATUSES = ['new', 'read'];

const createFeedbackSchema = Joi.object({
  message: Joi.string().trim().min(5).max(2000).required(),
});

const updateFeedbackSchema = Joi.object({
  status: Joi.string().valid(...FEEDBACK_STATUSES),
  reply: Joi.string().trim().max(2000).allow('', null),
}).or('status', 'reply');

module.exports = {
  createFeedbackSchema,
  updateFeedbackSchema,
  FEEDBACK_STATUSES,
  PENDING_FEEDBACK_STATUSES,
};
