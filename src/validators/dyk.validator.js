const Joi = require('joi');

const createDykCourseSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  subject_id: Joi.number().integer().allow(null),
  teacher_id: Joi.number().integer().allow(null),
  name: Joi.string().required().max(150),
  academic_year: Joi.string().allow('', null).max(20),
  min_attendance_rate: Joi.number().integer().min(0).max(100).allow(null),
  is_active: Joi.boolean().allow(null),
});

const updateDykCourseSchema = createDykCourseSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  name: Joi.string().optional().max(150),
});

const enrollStudentsSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  student_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
});

const markAttendanceSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  session_date: Joi.date().iso().required(),
  entries: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().required(),
        present: Joi.boolean().required(),
      })
    )
    .min(1)
    .required(),
});

module.exports = {
  createDykCourseSchema,
  updateDykCourseSchema,
  enrollStudentsSchema,
  markAttendanceSchema,
};
