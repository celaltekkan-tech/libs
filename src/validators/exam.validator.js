const Joi = require('joi');

const EXAM_TYPES = ['yazili', 'ortak', 'telafi', 'sorumluluk'];

const createExamSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  classroom_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().required(),
  exam_type: Joi.string()
    .valid(...EXAM_TYPES)
    .required(),
  exam_date: Joi.date().iso().required(),
  start_time: Joi.string().allow('', null).max(10),
  duration_minutes: Joi.number().integer().min(1).max(600).allow(null),
  teacher_id: Joi.number().integer().allow(null),
  notes: Joi.string().allow('', null).max(255),
});

const updateExamSchema = createExamSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  classroom_id: Joi.number().integer().optional(),
  subject_id: Joi.number().integer().optional(),
  exam_type: Joi.string()
    .valid(...EXAM_TYPES)
    .optional(),
  exam_date: Joi.date().iso().optional(),
});

const exportExamSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
});

const sorumlulukImportRowSchema = Joi.object({
  student_number: Joi.string().trim().required().max(20),
  student_name: Joi.string().trim().required().max(150),
  current_class_level: Joi.string().trim().allow('', null).max(10),
  current_section: Joi.string().trim().allow('', null).max(10),
  subject_class_level: Joi.string().trim().required().max(10),
  subject_name: Joi.string().trim().required().max(150),
  student_id: Joi.number().integer().allow(null),
  classroom_id: Joi.number().integer().allow(null),
  school_id: Joi.number().integer().allow(null),
  subject_id: Joi.number().integer().allow(null),
});

const sorumlulukImportCommitSchema = Joi.object({
  school_id: Joi.number().integer().allow(null),
  rows: Joi.array().items(sorumlulukImportRowSchema).min(1).max(5000).required(),
});

const sorumlulukCreateSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  subject_class_level: Joi.string().trim().required().max(10),
  subject_id: Joi.number().integer().allow(null),
  subject_name: Joi.string().trim().allow('', null).max(150),
}).or('subject_id', 'subject_name');

const committeeMemberSchema = Joi.object({
  teacher_id: Joi.number().integer().required(),
  role: Joi.string().valid('baskan', 'uye', 'gozetmen').default('uye'),
});

const sorumlulukScheduleSchema = Joi.object({
  subject_class_level: Joi.string().trim().required().max(10),
  subject_name: Joi.string().trim().required().max(150),
  exam_date: Joi.date().iso().allow(null).required(),
  start_time: Joi.string().allow('', null).max(10),
  oral_exam_date: Joi.date().iso().allow(null),
  oral_start_time: Joi.string().allow('', null).max(10),
  duration_minutes: Joi.number().integer().min(1).max(600).allow(null),
  teacher_id: Joi.number().integer().allow(null),
  committee_members: Joi.array().items(committeeMemberSchema).max(40).allow(null),
});

const sorumlulukUpdateSchema = Joi.object({
  exam_date: Joi.date().iso().allow(null),
  start_time: Joi.string().allow('', null).max(10),
  duration_minutes: Joi.number().integer().min(1).max(600).allow(null),
  teacher_id: Joi.number().integer().allow(null),
  notes: Joi.string().allow('', null).max(255),
});

module.exports = {
  createExamSchema,
  updateExamSchema,
  exportExamSchema,
  EXAM_TYPES,
  sorumlulukImportCommitSchema,
  sorumlulukCreateSchema,
  sorumlulukScheduleSchema,
  sorumlulukUpdateSchema,
};
