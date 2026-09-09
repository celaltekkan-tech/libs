'use strict';

const { AuditLog, User } = require('../models');
const licenseService = require('./licenseService');
const { getModulesForPlan } = require('../config/licensePlans');

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

async function planAllowsAudit(req) {
  if (Array.isArray(req.access?.modules)) {
    return req.access.modules.includes('audit');
  }

  const activeLicense = await licenseService.getActiveLicense(req.user.tenant_id);
  if (!activeLicense) return false;
  return getModulesForPlan(activeLicense.plan).includes('audit');
}

/**
 * Denetim kaydı yazar. Free planda yazılmaz. Hata ana isteği bozmaz.
 */
async function log(req, { action, entityType, entityId = null, summary, meta = null }) {
  try {
    if (!req?.user?.tenant_id) return;
    if (!(await planAllowsAudit(req))) return;

    let userName = req.access?.user?.full_name || null;
    let userEmail = req.access?.user?.email || req.user.email || null;

    if ((!userName || !userEmail) && req.user.user_id) {
      const user = await User.findByPk(req.user.user_id, {
        attributes: ['full_name', 'email'],
      });
      if (user) {
        userName = userName || user.full_name;
        userEmail = userEmail || user.email;
      }
    }

    await AuditLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.user_id || null,
      user_email: userEmail,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId == null ? null : Number(entityId),
      summary: String(summary).slice(0, 500),
      meta,
      ip: clientIp(req),
    });
  } catch (err) {
    console.error('[audit]', err.message || err);
  }
}

module.exports = { log };
