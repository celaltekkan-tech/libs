const Joi = require('joi');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const updateBackupSettingsSchema = Joi.object({
  retention_days: Joi.number().integer().min(1).max(365).required(),
  backup_dir: Joi.string().trim().min(1).max(500).required(),
  schedule_time: Joi.string().trim().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': 'Yedekleme saati HH:mm formatında olmalıdır',
  }),
});

module.exports = { updateBackupSettingsSchema };
