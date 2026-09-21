const Joi = require('joi');

const FEEDBACK_STATUSES = ['new', 'read', 'waiting', 'resolved', 'cancelled'];
/** Liste filtresi "Bekleyenler": yalnızca henüz incelenmemiş (yeni) kayıtlar */
const PENDING_FEEDBACK_STATUSES = ['new'];
/** Kullanıcının iptal edebileceği açık kayıtlar */
const OPEN_FEEDBACK_STATUSES = ['new', 'read', 'waiting'];
/** Kullanıcının gelişme ekleyebileceği aşamalar */
const REVIEW_FEEDBACK_STATUSES = ['read', 'waiting'];

const createFeedbackSchema = Joi.object({
  message: Joi.string().trim().min(5).max(10000).required(),
  page_path: Joi.string().trim().max(300).allow('', null),
  page_title: Joi.string().trim().max(120).allow('', null),
});

const updateFeedbackSchema = Joi.object({
  status: Joi.string().valid(...FEEDBACK_STATUSES),
  reply: Joi.string().trim().max(10000).allow('', null),
}).or('status', 'reply');

const cancelFeedbackSchema = Joi.object({
  cancel_reason: Joi.string().trim().min(3).max(500).required(),
});

/** İncelemedeki kayda eklenen gelişme / ek bilgi */
const addFeedbackUpdateSchema = Joi.object({
  body: Joi.string().trim().min(3).max(10000).required(),
});

module.exports = {
  createFeedbackSchema,
  updateFeedbackSchema,
  cancelFeedbackSchema,
  addFeedbackUpdateSchema,
  FEEDBACK_STATUSES,
  PENDING_FEEDBACK_STATUSES,
  OPEN_FEEDBACK_STATUSES,
  REVIEW_FEEDBACK_STATUSES,
};
