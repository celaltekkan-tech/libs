const Joi = require('joi');

const createTeacherNoteSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  tags: Joi.array().items(Joi.string().trim().max(120)).max(20).default([]),
  note: Joi.string().trim().allow('', null).max(1000),
})
  .custom((value, helpers) => {
    const hasTags = Array.isArray(value.tags) && value.tags.length > 0;
    const hasNote = typeof value.note === 'string' && value.note.trim().length > 0;
    if (!hasTags && !hasNote) {
      return helpers.error('any.custom', { message: 'En az bir sebep seçilmeli veya not yazılmalıdır' });
    }
    return value;
  })
  .messages({ 'any.custom': 'En az bir sebep seçilmeli veya not yazılmalıdır' });

module.exports = { createTeacherNoteSchema };
