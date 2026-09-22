const bcrypt = require('bcrypt');
const db = require('../models');
const { Tenant, School, User, Role, UserSchool } = db;
const { seedDefaultHolidays } = require('../services/holidayService');
const { applyDirectorySchoolToPayload } = require('../services/directorySchoolService');
const licenseService = require('../services/licenseService');

const MANAGER_ROLE_NAME = 'Müdür';
const BCRYPT_ROUNDS = 10;

async function countsByTenant(Model) {
  const rows = await Model.findAll({
    attributes: ['tenant_id', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
    group: ['tenant_id'],
    raw: true,
  });

  const map = new Map();
  rows.forEach((row) => map.set(row.tenant_id, Number(row.count)));
  return map;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenants = await Tenant.findAll({ order: [['id', 'ASC']] });
      const [schoolCounts, userCounts] = await Promise.all([
        countsByTenant(School),
        countsByTenant(User),
      ]);

      const data = tenants.map((tenant) => ({
        ...tenant.toJSON(),
        school_count: schoolCounts.get(tenant.id) || 0,
        user_count: userCounts.get(tenant.id) || 0,
      }));

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      res.json({ success: true, data: tenant });
    } catch (err) {
      next(err);
    }
  },

  async listSchools(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const schools = await School.findAll({
        where: { tenant_id: tenant.id },
        order: [['id', 'ASC']],
      });

      res.json({ success: true, data: schools });
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const users = await User.findAll({
        where: { tenant_id: tenant.id },
        attributes: { exclude: ['password_hash'] },
        include: [{ model: School, attributes: ['id', 'name', 'code'] }],
        order: [['id', 'ASC']],
      });

      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    const payload = req.validatedBody || req.body;

    const schoolPayload = { ...payload.school };
    try {
      await applyDirectorySchoolToPayload(schoolPayload);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      return next(err);
    }

    const existingSchool = await School.findOne({ where: { code: schoolPayload.code } });
    if (existingSchool) {
      return res.status(409).json({ success: false, message: 'Bu okul kodu zaten kullanılıyor' });
    }

    const existingUser = await User.findOne({ where: { email: payload.admin.email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_IN_USE',
        message: 'Bu e-posta zaten kullanılıyor',
      });
    }

    const transaction = await db.sequelize.transaction();

    try {
      const { assertValidMobilePhone } = require('../utils/phone');
      let tenantPhone = null;
      let adminPhone = null;
      try {
        tenantPhone = assertValidMobilePhone(payload.tenant.phone, { required: false });
        adminPhone = assertValidMobilePhone(payload.admin.phone, { required: true });
      } catch (err) {
        await transaction.rollback();
        return res.status(err.status || 400).json({
          success: false,
          code: err.code || 'PHONE_INVALID',
          message: err.message,
        });
      }

      const tenant = await Tenant.create(
        {
          name: payload.tenant.name,
          plan: payload.tenant.plan || null,
          phone: tenantPhone,
        },
        { transaction }
      );

      const school = await School.create(
        {
          tenant_id: tenant.id,
          name: schoolPayload.name,
          code: schoolPayload.code,
          school_type: schoolPayload.school_type,
          province_id: schoolPayload.province_id || null,
          district_id: schoolPayload.district_id || null,
          directory_school_id: schoolPayload.directory_school_id || null,
        },
        { transaction }
      );

      const password_hash = await bcrypt.hash(payload.admin.password, BCRYPT_ROUNDS);
      const adminUser = await User.create(
        {
          tenant_id: tenant.id,
          school_id: school.id,
          full_name: payload.admin.full_name,
          email: payload.admin.email,
          password_hash,
          role: 'admin',
          phone: adminPhone,
        },
        { transaction }
      );

      const managerRole = await Role.findOne({ where: { role_name: MANAGER_ROLE_NAME }, transaction });
      if (managerRole) {
        await UserSchool.create(
          { user_id: adminUser.id, school_id: school.id, role_id: managerRole.id },
          { transaction }
        );
      }

      // Sabit tarihli resmi tatiller her yeni hesap için varsayılan olarak tanımlanır.
      await seedDefaultHolidays(tenant.id, { transaction });

      await transaction.commit();

      const adminData = adminUser.toJSON();
      delete adminData.password_hash;

      res.status(201).json({
        success: true,
        data: { tenant, school, admin: adminData },
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const payload = req.validatedBody || req.body;
      const disabling2fa =
        Object.prototype.hasOwnProperty.call(payload, 'two_factor_enabled') &&
        payload.two_factor_enabled === false &&
        tenant.two_factor_enabled === true;
      const enablingSms =
        Object.prototype.hasOwnProperty.call(payload, 'sms_login_enabled') &&
        payload.sms_login_enabled === true &&
        !tenant.sms_login_enabled;

      const updates = { ...payload };
      if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
        const { assertValidMobilePhone } = require('../utils/phone');
        try {
          updates.phone = assertValidMobilePhone(payload.phone, { required: false });
        } catch (err) {
          return res.status(err.status || 400).json({
            success: false,
            code: err.code || 'PHONE_INVALID',
            message: err.message,
          });
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'plan') && payload.plan === '') {
        updates.plan = null;
      }

      const effectiveTenantPhone =
        updates.phone !== undefined ? updates.phone : tenant.phone;

      let usersPhoneSynced = 0;
      if (Object.prototype.hasOwnProperty.call(payload, 'phone') && updates.phone) {
        const { syncTenantPhoneToUsersWithoutPhone } = require('../utils/phone');
        usersPhoneSynced = await syncTenantPhoneToUsersWithoutPhone(tenant.id, updates.phone);
      }

      if (enablingSms) {
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
            tenantPhone: effectiveTenantPhone,
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

      if (disabling2fa) {
        await User.update(
          { totp_enabled: false, totp_secret: null, totp_backup_codes: null },
          { where: { tenant_id: tenant.id } }
        );
      }

      res.json({
        success: true,
        data: tenant,
        meta: { users_phone_synced: usersPhoneSynced },
      });
    } catch (err) {
      next(err);
    }
  },

  async resetTwoFactor(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const [affectedCount] = await User.update(
        { totp_enabled: false, totp_secret: null, totp_backup_codes: null },
        { where: { tenant_id: tenant.id } }
      );

      res.json({
        success: true,
        message: 'Hesaptaki tüm kullanıcıların 2FA ayarları sıfırlandı',
        data: {
          tenant_id: tenant.id,
          two_factor_enabled: Boolean(tenant.two_factor_enabled),
          reset_user_count: affectedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async resetUserTwoFactor(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const user = await User.findOne({
        where: { id: req.params.userId, tenant_id: tenant.id },
      });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      await user.update({
        totp_enabled: false,
        totp_secret: null,
        totp_backup_codes: null,
      });

      res.json({
        success: true,
        message: `2FA sıfırlandı: ${user.full_name}`,
        data: {
          user_id: user.id,
          totp_enabled: false,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async resetUserSmsLoginRequests(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const user = await User.findOne({
        where: { id: req.params.userId, tenant_id: tenant.id },
      });
      if (!user || user.is_platform_admin) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const smsLoginService = require('../services/smsLoginService');
      const loginLockout = require('../services/loginLockoutService');
      await smsLoginService.resetSmsRequestCounter(user);
      await loginLockout.clearFailures(user);

      res.json({
        success: true,
        message: `SMS giriş istek sayacı sıfırlandı: ${user.full_name}`,
        data: {
          user_id: user.id,
          sms_login_requests_count: 0,
          login_failed_count: 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const user = await User.findOne({
        where: { id: req.params.userId, tenant_id: tenant.id },
      });
      if (!user || user.is_platform_admin) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const payload = req.validatedBody || req.body;
      const nextEmail =
        payload.email !== undefined ? String(payload.email).toLowerCase().trim() : user.email;
      const nextFullName =
        payload.full_name !== undefined ? String(payload.full_name).trim() : user.full_name;

      const { assertValidMobilePhone } = require('../utils/phone');
      let nextPhone = user.phone;
      try {
        if (payload.phone !== undefined) {
          nextPhone = assertValidMobilePhone(payload.phone, {
            required: Boolean(tenant.sms_login_enabled),
          });
        } else if (tenant.sms_login_enabled) {
          assertValidMobilePhone(user.phone, { required: true });
        }
      } catch (err) {
        return res.status(err.status || 400).json({
          success: false,
          code: err.code || 'PHONE_INVALID',
          message: err.message,
        });
      }

      if (nextEmail !== user.email) {
        const existingUser = await User.findOne({ where: { email: nextEmail } });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            code: 'EMAIL_IN_USE',
            message: 'Bu e-posta zaten kullanılıyor',
          });
        }
      }

      await user.update({
        full_name: nextFullName,
        email: nextEmail,
        phone: nextPhone,
      });

      const data = user.toJSON();
      delete data.password_hash;
      delete data.totp_secret;
      delete data.totp_backup_codes;

      res.json({
        success: true,
        message: 'Kullanıcı bilgileri güncellendi',
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const [schoolCount, userCount] = await Promise.all([
        School.count({ where: { tenant_id: tenant.id } }),
        User.count({ where: { tenant_id: tenant.id } }),
      ]);

      if (schoolCount > 0 || userCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Bu hesaba bağlı okul veya kullanıcı var, önce onları kaldırın',
        });
      }

      await tenant.destroy();
      res.json({ success: true, message: 'Hesap silindi' });
    } catch (err) {
      next(err);
    }
  },
};
