const Joi = require('joi');
const { TYPES } = require('../services/timetableConstraintCatalog');

const id = Joi.number().integer().positive();
const weights = Joi.object({
  teacher_gaps: Joi.number().integer().min(0).max(1000),
  class_compact: Joi.number().integer().min(0).max(1000),
  teacher_single_hour_day: Joi.number().integer().min(0).max(1000),
  hard_subject_late: Joi.number().integer().min(0).max(1000),
  soft_constraint: Joi.number().integer().min(0).max(1000),
});
const settings = Joi.object({
  time_limit: Joi.number().integer().min(10).max(600),
  max_subject_daily: Joi.number().integer().min(1).max(8),
  weights,
});

const projectBase = {
  name: Joi.string().trim().max(150),
  academic_year: Joi.string().allow('', null).max(20),
  days: Joi.array().items(Joi.number().integer().min(1).max(6)).min(1).max(6).unique(),
  periods_per_day: Joi.number().integer().min(1).max(12),
  lunch_after: Joi.number().integer().min(1).max(11).allow(null),
  settings,
};

const createProjectSchema = Joi.object({
  ...projectBase,
  school_id: id.required(),
  name: projectBase.name.required(),
});
const updateProjectSchema = Joi.object(projectBase).min(1);

const roomBase = {
  name: Joi.string().trim().max(100),
  room_type: Joi.string().allow('', null).max(50),
  capacity: Joi.number().integer().min(1).max(20),
  is_active: Joi.boolean(),
};
const createRoomSchema = Joi.object({ ...roomBase, school_id: id.required(), name: roomBase.name.required() });
const updateRoomSchema = Joi.object(roomBase).min(1);

const assignmentBase = {
  classroom_id: id,
  subject_id: id,
  teacher_id: id.allow(null),
  weekly_hours: Joi.number().integer().min(1).max(40),
  block_pattern: Joi.string().allow('', null).max(40),
  room_id: id.allow(null),
  sync_group: Joi.string().allow('', null).max(50),
};
const createAssignmentSchema = Joi.object({
  ...assignmentBase,
  classroom_id: id.required(),
  subject_id: id.required(),
  weekly_hours: assignmentBase.weekly_hours.required(),
});
const updateAssignmentSchema = Joi.object(assignmentBase).min(1);
const bulkAssignmentSchema = Joi.object({
  ids: Joi.array().items(id).min(1).required(),
  teacher_id: id.allow(null),
  room_id: id.allow(null),
  sync_group: Joi.string().allow('', null).max(50),
}).or('teacher_id', 'room_id', 'sync_group');
const generateAssignmentsSchema = Joi.object({ overwrite: Joi.boolean().default(false) });

const constraintItem = Joi.object({
  type: Joi.string().valid(...Object.keys(TYPES)).required(),
  is_hard: Joi.boolean().required(),
  weight: Joi.number().integer().min(1).max(100).allow(null),
  params: Joi.object().unknown(true).required(),
  source: Joi.string().valid('manuel', 'ai'),
  source_text: Joi.string().allow('', null).max(2000),
});
const createConstraintsSchema = Joi.object({ items: Joi.array().items(constraintItem).min(1).max(50).required() });
const updateConstraintSchema = Joi.object({
  is_hard: Joi.boolean(),
  weight: Joi.number().integer().min(1).max(100).allow(null),
  params: Joi.object().unknown(true),
  is_active: Joi.boolean(),
}).min(1);
const aiParseSchema = Joi.object({ text: Joi.string().trim().min(3).max(2000).required() });

const startRunSchema = Joi.object({ time_limit: Joi.number().integer().min(10).max(600) });
const moveLessonSchema = Joi.object({
  day_of_week: Joi.number().integer().min(1).max(6).required(),
  period_no: Joi.number().integer().min(1).max(12).required(),
  force: Joi.boolean().default(false),
});
const lockLessonSchema = Joi.object({ is_locked: Joi.boolean().required() });
const lockAllSchema = Joi.object({ is_locked: Joi.boolean().required(), classroom_id: id, teacher_id: id });

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  createRoomSchema,
  updateRoomSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  bulkAssignmentSchema,
  generateAssignmentsSchema,
  createConstraintsSchema,
  updateConstraintSchema,
  aiParseSchema,
  startRunSchema,
  moveLessonSchema,
  lockLessonSchema,
  lockAllSchema,
};
