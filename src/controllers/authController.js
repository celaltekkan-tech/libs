const bcrypt = require('bcrypt');
const { User, Tenant, School } = require('../models');
const jwtUtil = require('../utils/jwt');
const accessService = require('../services/accessService');
const audit = require('../services/auditService');
const totpService = require('../services/totpService');
const smsLoginService = require('../services/smsLoginService');
const loginLockout = require('../services/loginLockoutService');
const licenseService = require('../services/licenseService');

const BCRYPT_ROUNDS = 10;
const PENDING_2FA_EXPIRES = '5m';
const PENDING_SMS_EXPIRES = '10m';

// Herkese açık kayıt ucu varsayılan olarak kapalıdır; kullanıcılar okul
// yönetimi tarafından /api/users üzerinden oluşturulur.
const publicRegisterEnabled = process.env.ALLOW_PUBLIC_REGISTER === 'true';

function createSessionToken(user) {
  return jwtUtil.sign({
    user_id: user.id,
    tenant_id: user.tenant_id,
    school_id: user.school_id,
    email: user.email,
    role: user.role,
  });
}

function createPending2faToken(user) {
  return jwtUtil.sign(
    {
      purpose: '2fa_pending',
      user_id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
    },
    { expiresIn: PENDING_2FA_EXPIRES }
  );
}

function createPendingSmsToken(user) {
  return jwtUtil.sign(
    {
      purpose: 'sms_pending',
      user_id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
    },
    { expiresIn: PENDING_SMS_EXPIRES }
  );
}

function verifyPendingToken(tempToken, expectedPurpose) {
  let payload;
  try {
    payload = jwtUtil.verify(tempToken);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    const error = new Error(
      expired ? 'Doğrulama süresi doldu, lütfen tekrar giriş yapın' : 'Geçersiz doğrulama oturumu',
    );
    error.status = 401;
    error.code = expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    throw error;
  }
  if (payload.purpose !== expectedPurpose || !payload.user_id) {
    const error = new Error('Geçersiz doğrulama oturumu');
    error.status = 401;
    error.code = 'TOKEN_INVALID';
    throw error;
  }
  return payload;
}

async function respondWithSession(res, user, status = 200) {
  const access = await accessService.getUserAccess(user.id);
  const { token, expires_at } = createSessionToken(user);

  return res.status(status).json({
    success: true,
    data: {
      ...(await accessService.buildSessionPayload(access)),
      token,
      expires_at,
    },
  });
}

async function finalizeLogin(req, res, user) {
  await loginLockout.clearFailures(user);
  await user.update({ last_login_at: new Date() });

  const fakeReq = {
    user: { user_id: user.id, tenant_id: user.tenant_id, email: user.email },
    access: { user },
    headers: req.headers,
    ip: req.ip,
    socket: req.socket,
  };
  await audit.log(fakeReq, {
    action: 'login',
    entityType: 'auth',
    entityId: user.id,
    summary: `Giriş yapıldı: ${user.full_name}`,
  });

  return respondWithSession(res, user);
}

async function rejectInvalidCredentials(res, user) {
  if (user) {
    const result = await loginLockout.registerFailure(user);
    if (result.locked) {
      return res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: loginLockout.lockMessage(user),
      });
    }
  }
  return res.status(401).json({
    success: false,
    code: 'INVALID_CREDENTIALS',
    message: 'E-posta veya şifre hatalı',
  });
}

module.exports = {
  async register(req, res, next) {
    try {
      if (!publicRegisterEnabled) {
        return res.status(403).json({
          success: false,
          code: 'REGISTRATION_DISABLED',
          message: 'Kayıt işlemi kapalıdır. Hesabınızı okul yöneticisi oluşturur.',
        });
      }

      const payload = req.validatedBody || req.body;

      const tenant = await Tenant.findByPk(payload.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant bulunamadı' });
      }

      if (payload.school_id) {
        const school = await School.findByPk(payload.school_id);
        if (!school) {
          return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
        }
        if (school.tenant_id !== payload.tenant_id) {
          return res.status(403).json({ success: false, message: 'Okul bu tenant\'a ait değil' });
        }
      }

      const existingUser = await User.findOne({ where: { email: payload.email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_IN_USE',
          message: 'Bu e-posta zaten kullanılıyor',
        });
      }

      const password_hash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);

      const user = await User.create({
        tenant_id: payload.tenant_id,
        school_id: payload.school_id || null,
        full_name: payload.full_name,
        email: payload.email,
        password_hash,
        // Rol istemciden alınmaz; yetki yükseltmesini engellemek için sabittir.
        role: 'teacher',
      });

      return respondWithSession(res, user, 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.validatedBody || req.body;

      const user = await User.scope('withTotp').findOne({
        where: { email: String(email).toLowerCase().trim() },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'E-posta veya şifre hatalı',
        });
      }

      try {
        await loginLockout.assertNotLocked(user);
      } catch (err) {
        return res.status(err.status || 423).json({
          success: false,
          code: err.code || 'ACCOUNT_LOCKED',
          message: err.message,
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return rejectInvalidCredentials(res, user);
      }

      if (!user.is_active) {
        if (user.teacher_id) {
          return res.status(403).json({
            success: false,
            code: 'ACCOUNT_UNVERIFIED',
            message:
              'Hesabınız henüz doğrulanmadı. Mobil uygulamadan e-posta veya SMS doğrulamasını tamamlayın.',
          });
        }
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Hesabınız pasif durumda. Okul yöneticinizle iletişime geçin.',
        });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant || !tenant.is_active) {
        return res.status(403).json({
          success: false,
          code: 'TENANT_DISABLED',
          message: 'Hesabınız askıya alınmış. Lütfen destek ile iletişime geçin.',
        });
      }

      if (user.totp_enabled && user.totp_secret) {
        const pending = createPending2faToken(user);
        return res.json({
          success: true,
          data: {
            requires_2fa: true,
            temp_token: pending.token,
            expires_at: pending.expires_at,
          },
        });
      }

      if (tenant.sms_login_enabled && !user.is_platform_admin) {
        const smsState = await licenseService.getSmsLicenseState(user.tenant_id);
        const canSms = Boolean(smsState && (smsState.sms_remaining == null || smsState.sms_remaining > 0));
        if (!canSms) {
          return finalizeLogin(req, res, user);
        }
        const { isValidMobilePhone } = require('../utils/phone');
        if (!isValidMobilePhone(user.phone)) {
          return res.status(403).json({
            success: false,
            code: 'SMS_PHONE_MISSING',
            message:
              'SMS ile giriş açık. Geçerli bir cep telefonunuz (05xxxxxxxxx) tanımlı olmalıdır.',
          });
        }
        try {
          const smsInfo = await smsLoginService.issueSmsLoginCode(user);
          const pending = createPendingSmsToken(user);
          return res.json({
            success: true,
            data: {
              requires_sms: true,
              temp_token: pending.token,
              expires_at: pending.expires_at,
              phone_hint: smsInfo.phone_hint,
              requests_remaining: smsInfo.requests_remaining,
              max_requests: smsInfo.max_requests,
            },
          });
        } catch (err) {
          if (err instanceof licenseService.SmsLicenseError) {
            return finalizeLogin(req, res, user);
          }
          return res.status(err.status || 500).json({
            success: false,
            code: err.code || 'SMS_SEND_FAILED',
            message: err.message || 'SMS gönderilemedi',
          });
        }
      }

      return finalizeLogin(req, res, user);
    } catch (err) {
      next(err);
    }
  },

  async verify2fa(req, res, next) {
    try {
      const { temp_token, code } = req.validatedBody || req.body;

      let payload;
      try {
        payload = verifyPendingToken(temp_token, '2fa_pending');
      } catch (err) {
        return res.status(err.status || 401).json({
          success: false,
          code: err.code || 'TOKEN_INVALID',
          message: err.message,
        });
      }

      const user = await User.scope('withTotp').findByPk(payload.user_id);
      if (!user || !user.is_active || !user.totp_enabled || !user.totp_secret) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'İki adımlı doğrulama tamamlanamadı',
        });
      }

      try {
        await loginLockout.assertNotLocked(user);
      } catch (err) {
        return res.status(err.status || 423).json({
          success: false,
          code: err.code || 'ACCOUNT_LOCKED',
          message: err.message,
        });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant || !tenant.is_active) {
        return res.status(403).json({
          success: false,
          code: 'TENANT_DISABLED',
          message: 'Hesabınız askıya alınmış. Lütfen destek ile iletişime geçin.',
        });
      }

      const totpOk = totpService.verifyToken(user.totp_secret, code);
      if (totpOk) {
        return finalizeLogin(req, res, user);
      }

      const backup = await totpService.consumeBackupCode(user.totp_backup_codes, code);
      if (backup.ok) {
        await user.update({ totp_backup_codes: backup.remaining });
        return finalizeLogin(req, res, user);
      }

      const fail = await loginLockout.registerFailure(user);
      if (fail.locked) {
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: loginLockout.lockMessage(user),
        });
      }

      return res.status(401).json({
        success: false,
        code: 'INVALID_2FA_CODE',
        message: 'Doğrulama kodu hatalı',
      });
    } catch (err) {
      next(err);
    }
  },

  async verifySms(req, res, next) {
    try {
      const { temp_token, code } = req.validatedBody || req.body;

      let payload;
      try {
        payload = verifyPendingToken(temp_token, 'sms_pending');
      } catch (err) {
        return res.status(err.status || 401).json({
          success: false,
          code: err.code || 'TOKEN_INVALID',
          message: err.message,
        });
      }

      const user = await User.scope('withTotp').findByPk(payload.user_id);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'SMS doğrulama tamamlanamadı',
        });
      }

      try {
        await loginLockout.assertNotLocked(user);
      } catch (err) {
        return res.status(err.status || 423).json({
          success: false,
          code: err.code || 'ACCOUNT_LOCKED',
          message: err.message,
        });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant || !tenant.is_active || !tenant.sms_login_enabled) {
        return res.status(403).json({
          success: false,
          code: 'SMS_LOGIN_DISABLED',
          message: 'SMS ile giriş bu hesap için kapalı',
        });
      }

      const ok = await smsLoginService.verifySmsLoginCode(user, code);
      if (!ok) {
        const fail = await loginLockout.registerFailure(user);
        if (fail.locked) {
          return res.status(423).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: loginLockout.lockMessage(user),
          });
        }
        return res.status(401).json({
          success: false,
          code: 'INVALID_SMS_CODE',
          message: 'SMS doğrulama kodu hatalı veya süresi dolmuş',
        });
      }

      return finalizeLogin(req, res, user);
    } catch (err) {
      next(err);
    }
  },

  async resendSms(req, res, next) {
    try {
      const { temp_token } = req.validatedBody || req.body;

      let payload;
      try {
        payload = verifyPendingToken(temp_token, 'sms_pending');
      } catch (err) {
        return res.status(err.status || 401).json({
          success: false,
          code: err.code || 'TOKEN_INVALID',
          message: err.message,
        });
      }

      const user = await User.scope('withTotp').findByPk(payload.user_id);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'SMS gönderilemedi',
        });
      }

      try {
        await loginLockout.assertNotLocked(user);
      } catch (err) {
        return res.status(err.status || 423).json({
          success: false,
          code: err.code || 'ACCOUNT_LOCKED',
          message: err.message,
        });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant || !tenant.is_active || !tenant.sms_login_enabled) {
        return res.status(403).json({
          success: false,
          code: 'SMS_LOGIN_DISABLED',
          message: 'SMS ile giriş bu hesap için kapalı',
        });
      }

      try {
        const smsInfo = await smsLoginService.issueSmsLoginCode(user);
        const pending = createPendingSmsToken(user);
        return res.json({
          success: true,
          message: 'Yeni SMS kodu gönderildi',
          data: {
            requires_sms: true,
            temp_token: pending.token,
            expires_at: pending.expires_at,
            phone_hint: smsInfo.phone_hint,
            requests_remaining: smsInfo.requests_remaining,
            max_requests: smsInfo.max_requests,
          },
        });
      } catch (err) {
        return res.status(err.status || 500).json({
          success: false,
          code: err.code || 'SMS_SEND_FAILED',
          message: err.message || 'SMS gönderilemedi',
        });
      }
    } catch (err) {
      next(err);
    }
  },

  async get2faStatus(req, res, next) {
    try {
      const user = await User.findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      return res.json({
        success: true,
        data: {
          tenant_two_factor_enabled: Boolean(tenant?.two_factor_enabled),
          tenant_sms_login_enabled: Boolean(tenant?.sms_login_enabled),
          totp_enabled: Boolean(user.totp_enabled),
          phone: user.phone || null,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async setup2fa(req, res, next) {
    try {
      const user = await User.scope('withTotp').findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant?.two_factor_enabled) {
        return res.status(403).json({
          success: false,
          code: '2FA_NOT_ENABLED_FOR_TENANT',
          message: 'Bu hesap için iki adımlı doğrulama kapalı. Yönetici açmalıdır.',
        });
      }

      if (user.totp_enabled) {
        return res.status(409).json({
          success: false,
          code: '2FA_ALREADY_ENABLED',
          message: 'İki adımlı doğrulama zaten açık',
        });
      }

      const secret = totpService.generateSecret();
      const otpauth_url = totpService.buildOtpauthUrl(secret, user.email);
      const qr_data_url = await totpService.buildQrDataUrl(otpauth_url);

      await user.update({ totp_secret: secret, totp_enabled: false, totp_backup_codes: null });

      return res.json({
        success: true,
        data: {
          secret,
          otpauth_url,
          qr_data_url,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async confirm2fa(req, res, next) {
    try {
      const { code } = req.validatedBody || req.body;
      const user = await User.scope('withTotp').findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      if (!tenant?.two_factor_enabled) {
        return res.status(403).json({
          success: false,
          code: '2FA_NOT_ENABLED_FOR_TENANT',
          message: 'Bu hesap için iki adımlı doğrulama kapalı',
        });
      }

      if (!user.totp_secret) {
        return res.status(400).json({
          success: false,
          code: '2FA_SETUP_REQUIRED',
          message: 'Önce kurulum başlatılmalıdır',
        });
      }

      if (user.totp_enabled) {
        return res.status(409).json({
          success: false,
          code: '2FA_ALREADY_ENABLED',
          message: 'İki adımlı doğrulama zaten açık',
        });
      }

      if (!totpService.verifyToken(user.totp_secret, code)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_2FA_CODE',
          message: 'Doğrulama kodu hatalı',
        });
      }

      const backupCodes = totpService.generateBackupCodes();
      const hashed = await totpService.hashBackupCodes(backupCodes);
      await user.update({ totp_enabled: true, totp_backup_codes: hashed });

      await audit.log(req, {
        action: 'update',
        entityType: 'auth',
        entityId: user.id,
        summary: 'İki adımlı doğrulama etkinleştirildi',
      });

      return res.json({
        success: true,
        message: 'İki adımlı doğrulama etkinleştirildi',
        data: { backup_codes: backupCodes },
      });
    } catch (err) {
      next(err);
    }
  },

  async disable2fa(req, res, next) {
    try {
      const { password, code } = req.validatedBody || req.body;
      const user = await User.scope('withTotp').findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      if (!user.totp_enabled) {
        return res.status(400).json({
          success: false,
          code: '2FA_NOT_ENABLED',
          message: 'İki adımlı doğrulama zaten kapalı',
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Şifreniz hatalı',
        });
      }

      const totpOk = totpService.verifyToken(user.totp_secret, code);
      let backupOk = false;
      if (!totpOk) {
        const backup = await totpService.consumeBackupCode(user.totp_backup_codes, code);
        backupOk = backup.ok;
      }

      if (!totpOk && !backupOk) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_2FA_CODE',
          message: 'Doğrulama kodu hatalı',
        });
      }

      await user.update({
        totp_secret: null,
        totp_enabled: false,
        totp_backup_codes: null,
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'auth',
        entityId: user.id,
        summary: 'İki adımlı doğrulama kapatıldı',
      });

      return res.json({
        success: true,
        message: 'İki adımlı doğrulama kapatıldı',
      });
    } catch (err) {
      next(err);
    }
  },

  async getTenantTwoFactorSetting(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access?.is_global_admin && !access?.is_platform_admin) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_DENIED',
          message: 'Bu işlem için yetkiniz yok',
        });
      }

      const tenant = await Tenant.findByPk(access.user.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      return res.json({
        success: true,
        data: {
          two_factor_enabled: Boolean(tenant.two_factor_enabled),
          sms_login_enabled: Boolean(tenant.sms_login_enabled),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateTenantTwoFactorSetting(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access?.is_global_admin) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_DENIED',
          message: 'Bu işlem için yönetici yetkisi gerekir',
        });
      }

      const body = req.validatedBody || req.body;
      const tenant = await Tenant.findByPk(access.user.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const updates = {};
      if (body.two_factor_enabled !== undefined) {
        updates.two_factor_enabled = Boolean(body.two_factor_enabled);
      }
      if (body.sms_login_enabled !== undefined) {
        updates.sms_login_enabled = Boolean(body.sms_login_enabled);
      }

      if (updates.sms_login_enabled === true) {
        try {
          await licenseService.assertCanSendSms(tenant.id, 1);
        } catch (err) {
          if (err instanceof licenseService.SmsLicenseError) {
            return res.status(err.status).json({
              success: false,
              code: err.code,
              message: err.message,
              ...(err.details || {}),
            });
          }
          throw err;
        }
        const { assertTenantUsersHaveValidPhones } = require('../utils/phone');
        try {
          await assertTenantUsersHaveValidPhones(tenant.id, {
            tenantPhone: tenant.phone,
          });
        } catch (err) {
          return res.status(err.status || 400).json({
            success: false,
            code: err.code || 'SMS_PHONE_REQUIRED',
            message: err.message,
          });
        }
      }

      await tenant.update(updates);

      // Tenant 2FA kapatılırsa kullanıcıların zorunlu doğrulaması da düşer.
      if (updates.two_factor_enabled === false) {
        await User.update(
          { totp_enabled: false, totp_secret: null, totp_backup_codes: null },
          { where: { tenant_id: tenant.id } }
        );
      }

      await audit.log(req, {
        action: 'update',
        entityType: 'tenant',
        entityId: tenant.id,
        summary: `Hesap güvenlik ayarları güncellendi (2FA=${tenant.two_factor_enabled}, SMS=${tenant.sms_login_enabled})`,
      });

      return res.json({
        success: true,
        message: 'Hesap güvenlik ayarları güncellendi',
        data: {
          two_factor_enabled: Boolean(tenant.two_factor_enabled),
          sms_login_enabled: Boolean(tenant.sms_login_enabled),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getMenuLayout(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access) {
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }
      if (access.is_platform_admin) {
        return res.json({ success: true, data: { layout: null } });
      }
      const tenant = await Tenant.findByPk(access.user.tenant_id, {
        attributes: ['id', 'menu_layout'],
      });
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }
      return res.json({ success: true, data: { layout: tenant.menu_layout || null } });
    } catch (err) {
      next(err);
    }
  },

  async updateMenuLayout(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access?.is_global_admin) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_DENIED',
          message: 'Menü düzenini yalnızca hesap yöneticisi değiştirebilir',
        });
      }
      if (access.is_platform_admin) {
        return res.status(400).json({
          success: false,
          message: 'Platform hesabında menü düzeni yok',
        });
      }

      const tenant = await Tenant.findByPk(access.user.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const body = req.validatedBody || req.body;
      const { normalizeMenuLayout } = require('../utils/menuLayout');
      let layout = null;
      if (body.layout != null) {
        try {
          layout = normalizeMenuLayout(body.layout);
        } catch (err) {
          return res.status(err.status || 400).json({
            success: false,
            code: err.code || 'MENU_LAYOUT_INVALID',
            message: err.message,
          });
        }
      }

      await tenant.update({ menu_layout: layout });
      await audit.log(req, {
        action: 'update',
        entityType: 'tenant',
        entityId: tenant.id,
        summary: layout ? 'Hesap menü düzeni güncellendi' : 'Hesap menü düzeni varsayılana alındı',
      });

      return res.json({
        success: true,
        message: layout ? 'Menü düzeni kaydedildi' : 'Menü düzeni varsayılana döndü',
        data: { layout },
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const access = await accessService.getUserAccess(req.user.user_id);

      if (!access) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Kullanıcı bulunamadı',
        });
      }

      if (!access.user.is_active) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Hesabınız pasif durumda',
        });
      }

      return res.json({
        success: true,
        data: await accessService.buildSessionPayload(access),
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { full_name, phone } = req.validatedBody || req.body;
      const user = await User.findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const tenant = await Tenant.findByPk(user.tenant_id);
      const smsRequired = Boolean(tenant?.sms_login_enabled) && !user.is_platform_admin;
      const { assertValidMobilePhone } = require('../utils/phone');

      const updates = { full_name: String(full_name).trim() };
      try {
        if (phone !== undefined) {
          updates.phone = assertValidMobilePhone(phone, { required: smsRequired });
        } else if (smsRequired) {
          assertValidMobilePhone(user.phone, { required: true });
        }
      } catch (err) {
        return res.status(err.status || 400).json({
          success: false,
          code: err.code || 'PHONE_INVALID',
          message: err.message,
        });
      }
      await user.update(updates);
      const access = await accessService.getUserAccess(user.id);
      await audit.log(req, {
        action: 'update',
        entityType: 'profile',
        entityId: user.id,
        summary: `Profil güncellendi: ${user.full_name}`,
      });
      return res.json({
        success: true,
        message: 'Profil güncellendi',
        data: await accessService.buildSessionPayload(access),
      });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.validatedBody || req.body;

      const user = await User.scope('withPassword').findByPk(req.user.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Mevcut şifreniz hatalı',
        });
      }

      const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
      await user.update({ password_hash });

      await audit.log(req, {
        action: 'update',
        entityType: 'auth',
        entityId: user.id,
        summary: 'Şifre değiştirildi',
      });

      // Şifre değiştiğinde istemcinin yeni token ile devam etmesi sağlanır.
      const { token, expires_at } = createSessionToken(user);

      return res.json({
        success: true,
        message: 'Şifreniz güncellendi',
        data: { token, expires_at },
      });
    } catch (err) {
      next(err);
    }
  },

  // Token stateless olduğu için sunucu tarafında iptal edilmez; uç, istemcinin
  // oturumu temizlemesi ve ileride token kara listesi eklenebilmesi için vardır.
  async logout(req, res) {
    return res.json({ success: true, message: 'Oturum kapatıldı' });
  },
};
