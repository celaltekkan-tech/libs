const bcrypt = require('bcrypt');
const { User, Tenant, School, Role, UserSchool } = require('../models');
const { SCHOOL_ROLES } = require('../validators/user.validator');
const licenseService = require('../services/licenseService');
const { getUserLimitForPlan } = require('../config/licensePlans');
const audit = require('../services/auditService');

const assignmentInclude = [
  {
    model: UserSchool,
    include: [
      { model: Role, attributes: ['id', 'role_name'] },
      { model: School, attributes: ['id', 'name', 'code'] },
    ],
  },
  { model: School, attributes: ['id', 'name', 'code'] },
];

function serializeManagedUser(user) {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password_hash;
  const assignments = data.UserSchools || [];
  const primary = assignments[0] || null;
  data.school_assignments = assignments.map((a) => ({
    id: a.id,
    school_id: a.school_id,
    role_id: a.role_id,
    school_role: a.Role?.role_name || null,
    school_name: a.School?.name || null,
  }));
  data.school_role = primary?.Role?.role_name || null;
  data.assigned_school_id = primary?.school_id || data.school_id || null;
  data.assigned_school_name = primary?.School?.name || data.School?.name || null;
  return data;
}

async function resolveSchoolRole(roleName) {
  const role = await Role.findOne({ where: { role_name: roleName } });
  if (!role) {
    const err = new Error(`Rol bulunamadı: ${roleName}`);
    err.status = 400;
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }
  return role;
}

async function assertSchoolInTenant(schoolId, tenantId) {
  const school = await School.findByPk(schoolId);
  if (!school) {
    const err = new Error('Okul bulunamadı');
    err.status = 404;
    throw err;
  }
  if (school.tenant_id !== tenantId) {
    const err = new Error('Okul bu hesaba ait değil');
    err.status = 403;
    throw err;
  }
  return school;
}

async function syncPrimarySchoolRole(userId, schoolId, roleId) {
  const existing = await UserSchool.findAll({ where: { user_id: userId } });
  if (existing.length === 0) {
    await UserSchool.create({ user_id: userId, school_id: schoolId, role_id: roleId });
    return;
  }
  // Tek birincil atama: ilk kaydı güncelle, fazlaları sil
  const [primary, ...rest] = existing;
  await primary.update({ school_id: schoolId, role_id: roleId });
  for (const row of rest) {
    await row.destroy();
  }
}

async function getTenantUserQuota(tenantId) {
  const activeLicense = await licenseService.getActiveLicense(tenantId);
  const plan = activeLicense?.plan || null;
  const limit = getUserLimitForPlan(plan);
  const count = await User.count({
    where: { tenant_id: tenantId, is_platform_admin: false },
  });
  return {
    plan,
    limit,
    count,
    remaining: limit == null ? null : Math.max(0, limit - count),
  };
}

module.exports = {
  async formOptions(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const [roles, schools, quota] = await Promise.all([
        Role.findAll({
          where: { role_name: SCHOOL_ROLES },
          attributes: ['id', 'role_name'],
          order: [['id', 'ASC']],
        }),
        School.findAll({
          where: { tenant_id: tenantId },
          attributes: ['id', 'name', 'code'],
          order: [['name', 'ASC']],
        }),
        getTenantUserQuota(tenantId),
      ]);

      res.json({
        success: true,
        data: {
          school_roles: roles.map((r) => ({ id: r.id, name: r.role_name })),
          schools,
          user_limit: quota.limit,
          user_count: quota.count,
          user_remaining: quota.remaining,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = { is_platform_admin: false };
      if (tenantId) where.tenant_id = tenantId;

      const users = await User.findAll({
        where,
        include: assignmentInclude,
        order: [['full_name', 'ASC']],
        limit: 500,
      });

      res.json({
        success: true,
        data: users.map((u) => serializeManagedUser(u)),
      });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: assignmentInclude,
      });

      if (!user || user.is_platform_admin) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      res.json({ success: true, data: serializeManagedUser(user) });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      const tenant = await Tenant.findByPk(payload.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      await assertSchoolInTenant(payload.school_id, payload.tenant_id);
      const role = await resolveSchoolRole(payload.school_role);

      const existingUser = await User.findOne({ where: { email: payload.email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_IN_USE',
          message: 'Bu e-posta zaten kullanılıyor',
        });
      }

      const quota = await getTenantUserQuota(payload.tenant_id);
      if (quota.limit != null && quota.count >= quota.limit) {
        return res.status(403).json({
          success: false,
          code: 'USER_LIMIT_REACHED',
          message: `"${quota.plan || 'Mevcut'}" planında en fazla ${quota.limit} kullanıcı oluşturulabilir. Limit doldu (${quota.count}/${quota.limit}).`,
        });
      }

      const password_hash = await bcrypt.hash(payload.password, 10);

      // Alt kullanıcılar global admin olmaz; arayüz yetkisi okul rolünden gelir.
      const user = await User.create({
        tenant_id: payload.tenant_id,
        school_id: payload.school_id,
        full_name: payload.full_name,
        email: payload.email,
        password_hash,
        role: 'user',
        is_active: payload.is_active !== false,
      });

      await UserSchool.create({
        user_id: user.id,
        school_id: payload.school_id,
        role_id: role.id,
      });

      const full = await User.findByPk(user.id, { include: assignmentInclude });
      await audit.log(req, {
        action: 'create',
        entityType: 'user',
        entityId: user.id,
        summary: `Kullanıcı oluşturuldu: ${user.full_name} (${payload.school_role})`,
      });
      res.status(201).json({ success: true, data: serializeManagedUser(full) });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user || user.is_platform_admin) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user.tenant_id || user.tenant_id;

      if (payload.email && payload.email !== user.email) {
        const existingUser = await User.findOne({ where: { email: payload.email } });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            code: 'EMAIL_IN_USE',
            message: 'Bu e-posta zaten kullanılıyor',
          });
        }
      }

      await assertSchoolInTenant(payload.school_id, tenantId);
      const role = await resolveSchoolRole(payload.school_role);

      const updates = {
        school_id: payload.school_id,
        full_name: payload.full_name ?? user.full_name,
        email: payload.email ?? user.email,
      };
      if (payload.is_active !== undefined) updates.is_active = payload.is_active;
      if (payload.password) {
        updates.password_hash = await bcrypt.hash(payload.password, 10);
      }

      // Kullanıcı kendi hesabını pasife çekemez (kilitlenme riski).
      if (
        req.user &&
        req.user.user_id === user.id &&
        updates.is_active === false
      ) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_DEACTIVATE_SELF',
          message: 'Kendi hesabınızı pasife alamazsınız',
        });
      }

      // Global admin rolünü alt kullanıcı formundan yükseltme
      if (!['admin', 'supervisor'].includes(user.role)) {
        updates.role = 'user';
      }

      await user.update(updates);
      await syncPrimarySchoolRole(user.id, payload.school_id, role.id);

      const full = await User.findByPk(user.id, { include: assignmentInclude });
      await audit.log(req, {
        action: 'update',
        entityType: 'user',
        entityId: user.id,
        summary: `Kullanıcı güncellendi: ${user.full_name} (${payload.school_role})`,
      });
      res.json({ success: true, data: serializeManagedUser(full) });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user || user.is_platform_admin) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      if (req.user && req.user.user_id === user.id) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_DELETE_SELF',
          message: 'Kendi hesabınızı silemezsiniz',
        });
      }

      const label = user.full_name;
      const id = user.id;
      await user.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'user',
        entityId: id,
        summary: `Kullanıcı silindi: ${label}`,
      });
      res.json({ success: true, message: 'Kullanıcı silindi' });
    } catch (err) {
      next(err);
    }
  },
};
