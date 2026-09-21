const Joi = require('joi');

const STATEMENT_TYPES = ['yazili_ifade', 'sozlu_ifade', 'savunma'];
const INFO_SOURCE_TYPES = ['ogretmen', 'rehberlik', 'arkadas', 'genel'];
const NOTICE_TYPES = ['ogrenciye_cagri', 'kurul_toplantisi'];

const createStatementSchema = Joi.object({
  participant_id: Joi.number().integer().required(),
  statement_type: Joi.string()
    .valid(...STATEMENT_TYPES)
    .required(),
  content: Joi.string().trim().allow('', null).max(8000),
  taken_by: Joi.string().trim().allow('', null).max(255),
  written_by: Joi.string().trim().allow('', null).max(255),
  taken_at: Joi.date().iso().allow(null),
  location: Joi.string().trim().allow('', null).max(255),
  questions: Joi.array()
    .items(Joi.object({ question: Joi.string().allow('', null), answer: Joi.string().allow('', null) }))
    .allow(null),
  student_home_phone: Joi.string().trim().allow('', null).max(30),
  student_mobile_phone: Joi.string().trim().allow('', null).max(30),
  student_home_address: Joi.string().trim().allow('', null).max(1000),
  guardian_work_phone: Joi.string().trim().allow('', null).max(30),
  guardian_mobile_phone: Joi.string().trim().allow('', null).max(30),
  guardian_work_address: Joi.string().trim().allow('', null).max(1000),
});

const updateStatementSchema = createStatementSchema.fork(['participant_id', 'statement_type'], (s) => s.optional());

const createInfoRequestSchema = Joi.object({
  participant_id: Joi.number().integer().required(),
  source_type: Joi.string()
    .valid(...INFO_SOURCE_TYPES)
    .required(),
  source_name: Joi.string().trim().allow('', null).max(255),
  source_branch: Joi.string().trim().allow('', null).max(255),
  content: Joi.object().unknown(true).default({}),
  response_date: Joi.date().iso().allow(null),
});

const updateInfoRequestSchema = createInfoRequestSchema.fork(['participant_id', 'source_type'], (s) => s.optional());

const createMeetingNoticeSchema = Joi.object({
  notice_type: Joi.string()
    .valid(...NOTICE_TYPES)
    .required(),
  participant_id: Joi.number().integer().allow(null),
  meeting_date: Joi.date().iso().allow(null),
  meeting_time: Joi.string().trim().allow('', null).max(20),
  location: Joi.string().trim().allow('', null).max(255),
  agenda: Joi.string().trim().allow('', null).max(4000),
  board_members: Joi.array().items(Joi.object({ name: Joi.string().allow(''), title: Joi.string().allow('') })).default([]),
});

const updateMeetingNoticeSchema = createMeetingNoticeSchema.fork(['notice_type'], (s) => s.optional()).keys({
  acknowledged: Joi.boolean(),
  acknowledged_date: Joi.date().iso().allow(null),
});

module.exports = {
  STATEMENT_TYPES,
  INFO_SOURCE_TYPES,
  NOTICE_TYPES,
  createStatementSchema,
  updateStatementSchema,
  createInfoRequestSchema,
  updateInfoRequestSchema,
  createMeetingNoticeSchema,
  updateMeetingNoticeSchema,
};
