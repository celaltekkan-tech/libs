const Joi = require('joi');

const createBehaviorPointSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  participant_id: Joi.number().integer().allow(null),
  decision_id: Joi.number().integer().allow(null),
  academic_year: Joi.string().trim().required(),
  points_deducted: Joi.number().integer().min(0).default(0),
  points_restored: Joi.number().integer().min(0).default(0),
  restore_date: Joi.date().iso().allow(null),
  reason: Joi.string().trim().allow('', null).max(1000),
});

const updateBehaviorPointSchema = Joi.object({
  points_deducted: Joi.number().integer().min(0),
  points_restored: Joi.number().integer().min(0),
  restore_date: Joi.date().iso().allow(null),
  reason: Joi.string().trim().allow('', null).max(1000),
});

module.exports = { createBehaviorPointSchema, updateBehaviorPointSchema };
