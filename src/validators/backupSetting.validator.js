const Joi = require('joi');

const updateBackupSettingsSchema = Joi.object({
  retention_days: Joi.number().integer().min(1).max(365).required(),
});

module.exports = { updateBackupSettingsSchema };
