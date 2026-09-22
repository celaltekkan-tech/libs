'use strict';

const { User } = require('../models');

/**
 * TR cep telefonu: 5XXXXXXXXX (10 hane).
 * 05xx, +905xx, 905xx girişleri normalize edilir.
 */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeMobilePhone(value) {
  let digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.startsWith('90') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits;
}

function isValidMobilePhone(value) {
  const digits = normalizeMobilePhone(value);
  return Boolean(digits && /^5\d{9}$/.test(digits));
}

function formatMobilePhone(value) {
  const digits = normalizeMobilePhone(value);
  if (!digits || !/^5\d{9}$/.test(digits)) return null;
  return `0${digits}`;
}

function assertValidMobilePhone(value, { required = false } = {}) {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) {
    if (required) {
      const err = new Error('Geçerli bir cep telefonu zorunludur (05xxxxxxxxx)');
      err.status = 400;
      err.code = 'PHONE_REQUIRED';
      throw err;
    }
    return null;
  }
  if (!isValidMobilePhone(raw)) {
    const err = new Error('Geçerli bir cep telefonu girin (örn. 05xx xxx xx xx)');
    err.status = 400;
    err.code = 'PHONE_INVALID';
    throw err;
  }
  return formatMobilePhone(raw);
}

/**
 * Kurum telefonunu, geçerli telefonu olmayan aktif kullanıcılara uygular.
 * @returns {Promise<number>} güncellenen kullanıcı sayısı
 */
async function syncTenantPhoneToUsersWithoutPhone(tenantId, phone) {
  const formatted = formatMobilePhone(phone);
  if (!formatted) return 0;

  const users = await User.findAll({
    where: { tenant_id: tenantId, is_active: true, is_platform_admin: false },
    attributes: ['id', 'phone'],
  });

  let updated = 0;
  for (const user of users) {
    if (isValidMobilePhone(user.phone)) continue;
    await user.update({ phone: formatted });
    updated += 1;
  }
  return updated;
}

/**
 * SMS ile giriş açılmadan önce aktif kullanıcıların geçerli telefonu olmalı.
 * Kurum telefonu varsa önce eksik kullanıcılara kopyalanır.
 */
async function assertTenantUsersHaveValidPhones(tenantId, { tenantPhone = null } = {}) {
  if (tenantPhone && isValidMobilePhone(tenantPhone)) {
    await syncTenantPhoneToUsersWithoutPhone(tenantId, tenantPhone);
  }

  const users = await User.findAll({
    where: { tenant_id: tenantId, is_active: true, is_platform_admin: false },
    attributes: ['id', 'full_name', 'phone'],
  });

  if (users.length === 0) {
    const err = new Error(
      'SMS ile giriş açmak için en az bir aktif kullanıcı ve geçerli telefon numarası gerekir',
    );
    err.status = 400;
    err.code = 'SMS_PHONE_REQUIRED';
    throw err;
  }

  const missing = users.filter((u) => !isValidMobilePhone(u.phone));
  if (missing.length > 0) {
    const names = missing
      .slice(0, 5)
      .map((u) => u.full_name)
      .join(', ');
    const more = missing.length > 5 ? ` ve ${missing.length - 5} kişi daha` : '';
    const err = new Error(
      `SMS ile giriş açmak için kullanıcı telefonları gerekli (Kurum telefonu ayrıdır). Eksik/geçersiz: ${names}${more}`,
    );
    err.status = 400;
    err.code = 'SMS_PHONE_REQUIRED';
    err.missing_count = missing.length;
    throw err;
  }
}

module.exports = {
  digitsOnly,
  normalizeMobilePhone,
  isValidMobilePhone,
  formatMobilePhone,
  assertValidMobilePhone,
  syncTenantPhoneToUsersWithoutPhone,
  assertTenantUsersHaveValidPhones,
};
