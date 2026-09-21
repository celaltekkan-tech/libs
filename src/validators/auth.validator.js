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

const teacherRegisterStartSchema = Joi.object({
  school_id: Joi.number().integer().required(),
  personnel_no: Joi.string().trim().min(1).max(50).required(),
  last_name: Joi.string().trim().min(1).max(80).required(),
  email: email.required().messages({
    'string.email': 'Geçerli bir e-posta adresi girin',
    'string.empty': 'E-posta zorunludur',
  }),
});

const teacherRegisterPendingSchema = Joi.object({
  pending_token: Joi.string().required().messages({
    'string.empty': 'Doğrulama oturumu zorunludur',
  }),
});

const teacherRegisterSmsSchema = teacherRegisterPendingSchema.keys({
  phone: Joi.string().trim().max(30).required().messages({
    'string.empty': 'Cep telefonu zorunludur',
  }),
});

function sixDigitCode(value, helpers) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) {
    return helpers.error('string.pattern.base');
  }
  return digits;
}

const teacherRegisterVerifySchema = teacherRegisterPendingSchema.keys({
  code: Joi.string()
    .trim()
    .custom(sixDigitCode)
    .required()
    .messages({
      'string.empty': 'Doğrulama kodu zorunludur',
      'string.pattern.base': '6 haneli doğrulama kodunu girin',
    }),
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
  two_factor_enabled: Joi.boolean(),
  sms_login_enabled: Joi.boolean(),
})
  .or('two_factor_enabled', 'sms_login_enabled')
  .min(1);

const verifySmsSchema = Joi.object({
  temp_token: Joi.string().required().messages({
    'string.empty': 'Doğrulama oturumu zorunludur',
  }),
  code: Joi.string()
    .trim()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.empty': 'SMS kodu zorunludur',
      'string.pattern.base': '6 haneli SMS kodunu girin',
    }),
});

const resendSmsSchema = Joi.object({
  temp_token: Joi.string().required().messages({
    'string.empty': 'Doğrulama oturumu zorunludur',
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

const updateProfileSchema = Joi.object({
  full_name: Joi.string().required().min(2).max(100).messages({
    'string.empty': 'Ad soyad zorunludur',
    'string.min': 'Ad soyad en az 2 karakter olmalıdır',
  }),
  phone: Joi.string().trim().max(30).allow('', null),
});

const menuKey = Joi.string().trim().pattern(/^(\/[\w\-./]*|grp-[\w-]+)$/).max(80);

const menuLayoutObjectSchema = Joi.object({
  version: Joi.number().valid(1).required(),
  order: Joi.array().items(menuKey).max(80).required(),
  groups: Joi.object()
    .pattern(
      /^grp-[\w-]+$/,
      Joi.object({
        label: Joi.string().trim().min(1).max(80).required(),
        children: Joi.array().items(Joi.string().trim().pattern(/^\/[\w\-./]*$/).max(80)).max(80).required(),
      }),
    )
    .max(40)
    .required(),
  hidden: Joi.array().items(Joi.string().trim().pattern(/^\/[\w\-./]*$/).max(80)).max(80).required(),
});

const tenantMenuLayoutSchema = Joi.object({
  layout: menuLayoutObjectSchema.allow(null).required(),
});

module.exports = {
  teacherRegisterStartSchema,
  teacherRegisterPendingSchema,
  teacherRegisterSmsSchema,
  teacherRegisterVerifySchema,
  registerSchema,
  loginSchema,
  verify2faSchema,
  confirm2faSchema,
  disable2faSchema,
  tenantTwoFactorSchema,
  verifySmsSchema,
  resendSmsSchema,
  changePasswordSchema,
  updateProfileSchema,
  tenantMenuLayoutSchema,
};
