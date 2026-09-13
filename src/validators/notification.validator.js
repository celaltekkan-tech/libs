const Joi = require('joi');

const createNotificationSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  body: Joi.string().trim().min(1).max(5000).required(),
  target_type: Joi.string().valid('users', 'tenant', 'all_tenants').required(),
  tenant_id: Joi.number().integer().when('target_type', {
    is: 'tenant',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null),
  }),
  user_ids: Joi.array()
    .items(Joi.number().integer())
    .when('target_type', {
      is: 'users',
      then: Joi.array().items(Joi.number().integer()).min(1).required(),
      otherwise: Joi.optional(),
    }),
});

module.exports = {
  createNotificationSchema,
};
