'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { SMS_STATUS, sendSms, SmsConfigError } = require('./smsEngine');
const licenseService = require('./licenseService');
const messageLogService = require('./messageLogService');

const MAX_SMS_REQUESTS_PER_DAY = Number(process.env.SMS_LOGIN_MAX_REQUESTS_PER_DAY) || 3;
const CODE_TTL_MS = (Number(process.env.SMS_LOGIN_CODE_TTL_MINUTES) || 5) * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function istanbulDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getRequestState(user) {
  const today = istanbulDateString();
  const sameDay = user.sms_login_requests_date === today;
  const count = sameDay ? Number(user.sms_login_requests_count || 0) : 0;
  return {
    today,
    count,
    remaining: Math.max(0, MAX_SMS_REQUESTS_PER_DAY - count),
  };
}

async function assertCanRequestSms(user) {
  const state = getRequestState(user);
  if (state.count >= MAX_SMS_REQUESTS_PER_DAY) {
    const err = new Error(
      `Bugün için SMS kodu hakkı doldu (en fazla ${MAX_SMS_REQUESTS_PER_DAY}). Yöneticiniz sayacı sıfırlayabilir.`,
    );
    err.code = 'SMS_DAILY_LIMIT';
    err.status = 429;
    throw err;
  }
  return state;
}

async function issueSmsLoginCode(user, { phone } = {}) {
  const { assertValidMobilePhone } = require('../utils/phone');
  let targetPhone;
  try {
    targetPhone = assertValidMobilePhone(phone || user.phone, { required: true });
  } catch (err) {
    err.code = err.code || 'SMS_PHONE_MISSING';
    throw err;
  }

  const state = await assertCanRequestSms(user);
  await licenseService.assertCanSendSms(user.tenant_id, 1);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  let smsResult;
  try {
    smsResult = await sendSms({
      phoneNumber: targetPhone,
      message: `Okul Idare giris kodunuz: ${code}. Kod ${Math.round(CODE_TTL_MS / 60000)} dk gecerlidir.`,
    });
  } catch (err) {
    if (err instanceof SmsConfigError) {
      const e = new Error('SMS motoru yapılandırma hatası');
      e.code = 'SMS_CONFIG';
      e.status = 500;
      throw e;
    }
    throw err;
  }

  if (smsResult.status !== SMS_STATUS.SUCCESS) {
    const err = new Error(smsResult.error || 'SMS gönderilemedi');
    err.code = 'SMS_SEND_FAILED';
    err.status = 502;
    throw err;
  }

  await messageLogService.record({
    tenantId: user.tenant_id,
    channel: 'sms',
    sourceModule: 'sms_login',
    sourceId: user.id,
    recipientLabel: user.full_name,
    recipientContact: targetPhone,
    subject: 'SMS giriş kodu',
    body: null,
    status: smsResult.status,
    error: smsResult.error,
    sentAt: new Date(),
  });
  await licenseService.consumeSmsCredits(user.tenant_id, 1);

  const nextCount = state.count + 1;
  await user.update({
    sms_login_code_hash: codeHash,
    sms_login_code_expires_at: expiresAt,
    sms_login_requests_date: state.today,
    sms_login_requests_count: nextCount,
  });

  return {
    phone_hint: maskPhone(targetPhone),
    expires_at: expiresAt.toISOString(),
    requests_used: nextCount,
    requests_remaining: Math.max(0, MAX_SMS_REQUESTS_PER_DAY - nextCount),
    max_requests: MAX_SMS_REQUESTS_PER_DAY,
  };
}

async function verifySmsLoginCode(user, code) {
  if (!user.sms_login_code_hash || !user.sms_login_code_expires_at) {
    return false;
  }
  if (new Date(user.sms_login_code_expires_at).getTime() < Date.now()) {
    return false;
  }
  const ok = await bcrypt.compare(String(code).trim(), user.sms_login_code_hash);
  if (!ok) return false;
  await user.update({
    sms_login_code_hash: null,
    sms_login_code_expires_at: null,
  });
  return true;
}

async function clearSmsLoginCode(user) {
  await user.update({
    sms_login_code_hash: null,
    sms_login_code_expires_at: null,
  });
}

async function resetSmsRequestCounter(user) {
  await user.update({
    sms_login_requests_count: 0,
    sms_login_requests_date: null,
    sms_login_code_hash: null,
    sms_login_code_expires_at: null,
  });
}

module.exports = {
  MAX_SMS_REQUESTS_PER_DAY,
  istanbulDateString,
  maskPhone,
  getRequestState,
  issueSmsLoginCode,
  verifySmsLoginCode,
  clearSmsLoginCode,
  resetSmsRequestCounter,
};
