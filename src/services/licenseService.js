const { License } = require('../models');
const { Op } = require('sequelize');
const { isAddonPlan, isSmsPlan, getSmsQuotaForPlan } = require('../config/licensePlans');

class SmsLicenseError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function activeLicenseWhere(tenantId) {
  return {
    tenant_id: tenantId,
    status: 'active',
    [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: new Date() } }],
  };
}

function isSmsLicenseEnded(license) {
  if (!license) return true;
  if (license.status !== 'active') return true;
  if (license.ends_at && new Date(license.ends_at).getTime() < Date.now()) return true;
  return false;
}

function resolveQuota(license) {
  if (license.sms_quota == null) return getSmsQuotaForPlan(license.plan);
  return license.sms_quota;
}

async function findActiveLicenses(tenantId, options = {}) {
  return License.findAll({
    where: activeLicenseWhere(tenantId),
    order: [['created_at', 'DESC']],
    ...options,
  });
}

/**
 * Tenant'ın şu anda geçerli ana lisansını döner (SMS eklentisi hariç).
 * Yoksa null — tenant lisanssız/süresi dolmuş kabul edilir.
 */
async function getActiveLicense(tenantId) {
  const rows = await findActiveLicenses(tenantId);
  return rows.find((row) => !isAddonPlan(row.plan)) || null;
}

async function getActiveSmsLicense(tenantId) {
  const rows = await findActiveLicenses(tenantId);
  return rows.find((row) => isSmsPlan(row.plan)) || null;
}

function serializeSmsLicense(license) {
  const quota = resolveQuota(license);
  const used = Number(license.sms_used || 0);
  const ended = isSmsLicenseEnded(license);
  return {
    id: license.id,
    tenant_id: license.tenant_id,
    plan: license.plan,
    status: license.status,
    starts_at: license.starts_at,
    ends_at: license.ends_at,
    sms_quota: quota,
    sms_used: used,
    // Lisans bitince/iptalde kalan kredi 0; yeni lisans 0 kullanılmış ile başlar.
    sms_remaining: ended ? 0 : quota == null ? null : Math.max(0, quota - used),
  };
}

async function getSmsLicenseState(tenantId) {
  const license = await getActiveSmsLicense(tenantId);
  if (!license) return null;
  return serializeSmsLicense(license);
}

async function attachSmsUsage(licenses) {
  for (const license of licenses) {
    if (!isSmsPlan(license.plan)) continue;
    const state = serializeSmsLicense(license);
    license.setDataValue('sms_used', state.sms_used);
    license.setDataValue('sms_remaining', state.sms_remaining);
    if (license.sms_quota == null && state.sms_quota != null) {
      license.setDataValue('sms_quota', state.sms_quota);
    }
  }
  return licenses;
}

async function consumeSmsCredits(tenantId, count = 1) {
  if (!count) return;
  const license = await getActiveSmsLicense(tenantId);
  if (!license) return;
  await License.increment('sms_used', { by: count, where: { id: license.id } });
}

/**
 * Kota düşecek SMS sayısı kadar hakkın olup olmadığını kontrol eder.
 * count 0 ise lisans olsa da olmasa da geçer (gönderilecek SMS yok).
 */
async function assertCanSendSms(tenantId, count = 1) {
  if (!count) return getSmsLicenseState(tenantId);

  const license = await getActiveSmsLicense(tenantId);
  if (!license) {
    throw new SmsLicenseError(
      'SMS_LICENSE_REQUIRED',
      'SMS gönderimi için aktif SMS kullanım lisansı yok. Platform yöneticisinden SMS eklentisi isteyin.',
      403
    );
  }

  const state = serializeSmsLicense(license);
  if (state.sms_quota != null && state.sms_used + count > state.sms_quota) {
    throw new SmsLicenseError(
      'SMS_QUOTA_EXCEEDED',
      `SMS kotası yetersiz (${state.sms_used}/${state.sms_quota}). Bu gönderim ${count} SMS gerektiriyor.`,
      402,
      { sms_quota: state.sms_quota, sms_used: state.sms_used, sms_remaining: state.sms_remaining }
    );
  }
  return state;
}

module.exports = {
  SmsLicenseError,
  getActiveLicense,
  getActiveSmsLicense,
  getSmsLicenseState,
  attachSmsUsage,
  assertCanSendSms,
  consumeSmsCredits,
  findActiveLicenses,
};
