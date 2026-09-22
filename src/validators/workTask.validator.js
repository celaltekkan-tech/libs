'use strict';

const Joi = require('joi');
const { FREQUENCIES, NOTIFY_CHANNELS } = require('../services/workTaskService');

const recurrenceConfigSchema = Joi.object({
  weekday: Joi.number().integer().min(1).max(7),
  day: Joi.number().integer().min(1).max(31),
  month: Joi.number().integer().min(1).max(12),
}).unknown(false);

const createWorkTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).required(),
  description: Joi.string().trim().max(5000).allow('', null),
  assignee_user_id: Joi.number().integer().required(),
  frequency: Joi.string()
    .valid(...FREQUENCIES)
    .default('once'),
  recurrence_config: recurrenceConfigSchema.allow(null),
  next_due_at: Joi.date().iso().required(),
  remind_before_minutes: Joi.number().integer().min(0).max(60 * 24 * 30).default(1440),
  is_mandatory: Joi.boolean().default(false),
  notify_channels: Joi.array()
    .items(Joi.string().valid(...NOTIFY_CHANNELS))
    .unique()
    .default([]),
});

const updateWorkTaskSchema = createWorkTaskSchema
  .fork(['title', 'assignee_user_id', 'next_due_at'], (s) => s.optional())
  .keys({
    status: Joi.string().valid('active', 'paused', 'cancelled'),
  })
  .min(1);

module.exports = {
  createWorkTaskSchema,
  updateWorkTaskSchema,
};
