const Joi = require('joi');

const createExamRoomSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  name: Joi.string().required().max(100),
  capacity: Joi.number().integer().min(1).max(500).required(),
});

const updateExamRoomSchema = createExamRoomSchema.keys({
  tenant_id: Joi.number().integer().optional(),
  name: Joi.string().optional().max(100),
  capacity: Joi.number().integer().min(1).max(500).optional(),
});

const createExamSessionSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  name: Joi.string().required().max(150),
  exam_date: Joi.date().iso().required(),
  notes: Joi.string().allow('', null).max(255),
});

const generateSeatingSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  exam_room_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  classroom_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
});

const markAttendanceSchema = Joi.object({
  entries: Joi.array()
    .items(
      Joi.object({
        seat_assignment_id: Joi.number().integer().required(),
        present: Joi.boolean().required(),
      })
    )
    .min(1)
    .required(),
});

const assignProctorSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  exam_room_id: Joi.number().integer().required(),
  teacher_id: Joi.number().integer().required(),
});

module.exports = {
  createExamRoomSchema,
  updateExamRoomSchema,
  createExamSessionSchema,
  generateSeatingSchema,
  markAttendanceSchema,
  assignProctorSchema,
};
