const Joi = require('joi');

// Kurumsal ve iç ağ alan adları (okul.local, .k12.tr vb.) engellenmesin diye
// Joi'nin varsayılan TLD listesi devre dışı bırakılır.
const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const password = Joi.string().min(8).max(100).messages({
  'string.min': 'Şifre en az 8 karakter olmalıdır',
  'string.empty': 'Şifre zorunludur',
});

const registerSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  school_id: Joi.number().integer().allow(null),
  full_name: Joi.string().required().min(2).max(100),
  email: email.required(),
  password: password.required(),
});

const loginSchema = Joi.object({
  email: email.required().messages({
    'string.email': 'Geçerli bir e-posta adresi girin',
    'string.empty': 'E-posta zorunludur',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Şifre zorunludur',
  }),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'string.empty': 'Mevcut şifre zorunludur',
  }),
  new_password: password.required().invalid(Joi.ref('current_password')).messages({
    'any.invalid': 'Yeni şifre mevcut şifreyle aynı olamaz',
  }),
});

module.exports = { registerSchema, loginSchema, changePasswordSchema };
