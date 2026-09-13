const Joi = require('joi');

// Kurumsal ve iç ağ alan adları (okul.local, .k12.tr vb.) engellenmesin diye
// Joi'nin varsayılan TLD listesi devre dışı bırakılır.
const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const password = Joi.string().min(8).max(100).messages({
  'string.min': 'Şifre en az 8 karakter olmalıdır',
  'string.empty': 'Şifre zorunludur',
});

const totpCode = Joi.string()
  .trim()
  .pattern(/^[0-9A-Fa-f\s-]{6,20}$/)
  .required()
  .messages({
    'string.empty': 'Doğrulama kodu zorunludur',
    'string.pattern.base': 'Geçerli bir doğrulama kodu girin',
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

const verify2faSchema = Joi.object({
  temp_token: Joi.string().required().messages({
    'string.empty': 'Doğrulama oturumu zorunludur',
  }),
  code: totpCode,
});

const confirm2faSchema = Joi.object({
  code: totpCode,
});

const disable2faSchema = Joi.object({
  password: Joi.string().required().messages({
    'string.empty': 'Şifre zorunludur',
  }),
  code: totpCode,
});

const tenantTwoFactorSchema = Joi.object({
  two_factor_enabled: Joi.boolean().required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'string.empty': 'Mevcut şifre zorunludur',
  }),
  new_password: password.required().invalid(Joi.ref('current_password')).messages({
    'any.invalid': 'Yeni şifre mevcut şifreyle aynı olamaz',
  }),
});

const updateProfileSchema = Joi.object({
  full_name: Joi.string().required().min(2).max(100).messages({
    'string.empty': 'Ad soyad zorunludur',
    'string.min': 'Ad soyad en az 2 karakter olmalıdır',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  verify2faSchema,
  confirm2faSchema,
  disable2faSchema,
  tenantTwoFactorSchema,
  changePasswordSchema,
  updateProfileSchema,
};
