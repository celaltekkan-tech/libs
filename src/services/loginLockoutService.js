'use strict';

const MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS) || 5;
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES) || 15;

const CLEARED_LOCK = {
  login_failed_count: 0,
  login_locked_until: null,
  login_locked_at: null,
  login_lock_ip: null,
};

function clientIp(req) {
  if (!req) return null;
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function isLocked(user) {
  if (!user.login_locked_until) return false;
  return new Date(user.login_locked_until).getTime() > Date.now();
}

function lockMessage(user) {
  const until = user.login_locked_until ? new Date(user.login_locked_until) : null;
  const mins = until ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000)) : LOCK_MINUTES;
  return `Hesap geçici olarak kilitlendi. ${mins} dakika sonra tekrar deneyin.`;
}

async function assertNotLocked(user) {
  if (!isLocked(user)) {
    if (user.login_locked_until) {
      await user.update({ ...CLEARED_LOCK });
    }
    return;
  }
  const err = new Error(lockMessage(user));
  err.code = 'ACCOUNT_LOCKED';
  err.status = 423;
  throw err;
}

async function registerFailure(user, req) {
  const nextCount = Number(user.login_failed_count || 0) + 1;
  const updates = { login_failed_count: nextCount };
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    updates.login_locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    updates.login_locked_at = new Date();
    updates.login_lock_ip = clientIp(req);
  }
  await user.update(updates);
  return {
    failed_count: nextCount,
    locked: Boolean(updates.login_locked_until),
    locked_until: updates.login_locked_until || null,
  };
}

async function clearFailures(user) {
  if (!user.login_failed_count && !user.login_locked_until && !user.login_locked_at) return;
  await user.update({ ...CLEARED_LOCK });
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  clientIp,
  isLocked,
  lockMessage,
  assertNotLocked,
  registerFailure,
  clearFailures,
};
