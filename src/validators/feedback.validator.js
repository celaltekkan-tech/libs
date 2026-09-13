const Joi = require('joi');

const FEEDBACK_STATUSES = ['new', 'read', 'resolved', 'cancelled'];
/** Liste filtresi "Bekleyenler": yalnızca henüz incelenmemiş (yeni) kayıtlar */
const PENDING_FEEDBACK_STATUSES = ['new'];
/** Kullanıcının iptal edebileceği açık kayıtlar */
const OPEN_FEEDBACK_STATUSES = ['new', 'read'];

const createFeedbackSchema = Joi.object({
  message: Joi.string().trim().min(5).max(10000).required(),
});

const updateFeedbackSchema = Joi.object({
  status: Joi.string().valid(...FEEDBACK_STATUSES),
  reply: Joi.string().trim().max(10000).allow('', null),
}).or('status', 'reply');

const cancelFeedbackSchema = Joi.object({
  cancel_reason: Joi.string().trim().min(3).max(500).required(),
});

module.exports = {
  createFeedbackSchema,
  updateFeedbackSchema,
  cancelFeedbackSchema,
  FEEDBACK_STATUSES,
  PENDING_FEEDBACK_STATUSES,
  OPEN_FEEDBACK_STATUSES,
};
