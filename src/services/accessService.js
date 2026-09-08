const { User, UserSchool, Role, Permission, School } = require('../models');

// Bu roller User tablosundaki global rol alanında tutulur ve okul bazlı
// atamalardan bağımsız olarak tüm izinleri kapsar.
const GLOBAL_ADMIN_ROLES = ['admin', 'supervisor'];

/**
 * Kullanıcının rollerini, izinlerini ve bağlı olduğu okulları tek seferde döner.
 * Frontend menü/buton yetkilendirmesi ve permission middleware aynı kaynağı kullanır.
 */
async function getUserAccess(userId) {
  const user = await User.findByPk(userId);
  if (!user) return null;

  const assignments = await UserSchool.findAll({
    where: { user_id: userId },
    include: [
      { model: Role, include: [{ model: Permission, through: { attributes: [] } }] },
      { model: School, attributes: ['id', 'name', 'code'] },
    ],
  });

  const roles = new Set();
  const permissions = new Set();
  const schools = new Map();

  assignments.forEach((assignment) => {
    if (assignment.Role) {
      roles.add(assignment.Role.role_name);
      (assignment.Role.Permissions || []).forEach((permission) => {
        permissions.add(permission.permission_key);
      });
    }

    if (assignment.School && !schools.has(assignment.School.id)) {
      schools.set(assignment.School.id, {
        id: assignment.School.id,
        name: assignment.School.name,
        code: assignment.School.code,
        role: assignment.Role ? assignment.Role.role_name : null,
      });
    }
  });

  const isGlobalAdmin = GLOBAL_ADMIN_ROLES.includes(user.role);

  if (isGlobalAdmin) {
    const allPermissions = await Permission.findAll({ attributes: ['permission_key'] });
    allPermissions.forEach((permission) => permissions.add(permission.permission_key));
  }

  return {
    user,
    is_global_admin: isGlobalAdmin,
    is_platform_admin: user.is_platform_admin,
    roles: Array.from(roles),
    permissions: Array.from(permissions).sort(),
    schools: Array.from(schools.values()),
  };
}

function serializeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    school_id: user.school_id,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
  };
}

/**
 * Login ve /me uçlarının döndüğü ortak oturum gövdesi.
 */
function buildSessionPayload(access) {
  return {
    user: serializeUser(access.user),
    roles: access.roles,
    permissions: access.permissions,
    schools: access.schools,
    is_global_admin: access.is_global_admin,
    is_platform_admin: access.is_platform_admin,
  };
}

module.exports = {
  GLOBAL_ADMIN_ROLES,
  getUserAccess,
  serializeUser,
  buildSessionPayload,
};
