'use strict';

const { User, UserSchool, Role, School } = require('../models');

function cleanName(value) {
  return String(value || '').trim();
}

/**
 * Okul kaydındaki müdür adı. Hesabı açan kişinin rolünden bağımsızdır.
 */
async function nameFromSchool(tenantId, schoolId) {
  if (schoolId) {
    const school = await School.findByPk(schoolId, {
      attributes: ['id', 'tenant_id', 'principal_name'],
    });
    if (!school) return '';
    if (tenantId && Number(school.tenant_id) !== Number(tenantId)) return '';
    return cleanName(school.principal_name);
  }

  if (!tenantId) return '';
  const schools = await School.findAll({
    where: { tenant_id: tenantId },
    attributes: ['principal_name'],
    order: [['id', 'ASC']],
  });
  for (const school of schools) {
    const name = cleanName(school.principal_name);
    if (name) return name;
  }
  return '';
}

/**
 * Önce okul bilgilerindeki müdür adı.
 * fallback true ise ad boşken kurumdaki Müdür rolündeki hesaba düşer.
 */
async function resolvePrincipalName(tenantId, schoolId, { fallback = true } = {}) {
  const fromSchool = await nameFromSchool(tenantId, schoolId);
  if (fromSchool) return fromSchool;
  if (!fallback && !schoolId) return '';

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
  } else if (!fallback) {
    return '';
  }

  const anyMudur = await UserSchool.findOne({
    where: { role_id: mudurRole.id },
    include: [includeUser],
    order: [['id', 'ASC']],
  });
  return anyMudur?.User?.full_name || '';
}

module.exports = { resolvePrincipalName };
