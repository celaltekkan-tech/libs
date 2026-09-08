const bcrypt = require('bcrypt');
const { User, Tenant, School } = require('../models');
const jwtUtil = require('../utils/jwt');
const accessService = require('../services/accessService');

const BCRYPT_ROUNDS = 10;

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

async function respondWithSession(res, user, status = 200) {
  const access = await accessService.getUserAccess(user.id);
  const { token, expires_at } = createSessionToken(user);

  return res.status(status).json({
    success: true,
    data: {
      ...accessService.buildSessionPayload(access),
      token,
      expires_at,
    },
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

      const user = await User.scope('withPassword').findOne({
        where: { email: String(email).toLowerCase().trim() },
      });

      // Kullanıcı bulunamasa bile aynı mesaj döner; hesap keşfini engeller.
      if (!user) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'E-posta veya şifre hatalı',
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'E-posta veya şifre hatalı',
        });
      }

      if (!user.is_active) {
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

      await user.update({ last_login_at: new Date() });

      return respondWithSession(res, user);
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

      return res.json({ success: true, data: accessService.buildSessionPayload(access) });
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
