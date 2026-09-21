'use strict';

const { User, UserSchool, Role } = require('../models');

/**
 * Seçili okula Müdür rolüyle atanmış hesabın adı.
 * fallback true ise okulda müdür yokken kurumdaki herhangi bir müdür hesabına düşer.
 */
async function resolvePrincipalName(tenantId, schoolId, { fallback = true } = {}) {
  const mudurRole = await Role.findOne({ where: { role_name: 'Müdür' } });
  if (!mudurRole) return '';

  const includeUser = {
    model: User,
    attributes: ['id', 'full_name', 'tenant_id', 'is_active'],
    required: true,
    where: { tenant_id: tenantId, is_active: true },
  };

  if (schoolId) {
    const bySchool = await UserSchool.findOne({
      where: { role_id: mudurRole.id, school_id: schoolId },
      include: [includeUser],
      order: [['id', 'ASC']],
    });
    if (bySchool?.User?.full_name) return bySchool.User.full_name;
    if (!fallback) return '';
  }

  const anyMudur = await UserSchool.findOne({
    where: { role_id: mudurRole.id },
    include: [includeUser],
    order: [['id', 'ASC']],
  });
  return anyMudur?.User?.full_name || '';
}

module.exports = { resolvePrincipalName };
