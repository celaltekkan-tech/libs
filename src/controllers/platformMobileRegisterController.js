'use strict';

const { User } = require('../models');
const teacherRegister = require('../services/teacherSelfRegisterService');
const audit = require('../services/auditService');

function actorFromRequest(req, reviewer) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' && forwarded.length
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || null;
  return {
    userId: req.user.user_id,
    name: reviewer?.full_name || null,
    email: reviewer?.email || req.user.email || null,
    ip,
    userAgent: req.get('user-agent'),
  };
}

function queryText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

module.exports = {
  async list(req, res, next) {
    try {
      const visibility = ['visible', 'hidden', 'all'].includes(req.query.visibility)
        ? req.query.visibility
        : 'all';
      const tenantId = Number.parseInt(String(req.query.tenant_id || ''), 10);
      const rows = await teacherRegister.listAllRequests({
        status: queryText(req.query.status),
        q: queryText(req.query.q),
        visibility,
        tenantId: Number.isInteger(tenantId) && tenantId > 0 ? tenantId : undefined,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async setVisibility(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const reviewer = await User.findByPk(req.user.user_id, { attributes: ['id', 'full_name', 'email'] });
      const row = await teacherRegister.setAnyRequestVisibility(
        req.params.id,
        payload.hidden === true,
        actorFromRequest(req, reviewer),
      );
      await audit.log(req, {
        action: 'update',
        entityType: 'mobile_register_request',
        entityId: row.id,
        summary: payload.hidden
          ? `Platform mobil kayıt isteğini gizledi: ${row.full_name}`
          : `Platform mobil kayıt isteğini yeniden gösterdi: ${row.full_name}`,
      });
      res.json({
        success: true,
        message: payload.hidden ? 'İstek kurum listesinden gizlendi' : 'İstek kurum listesinde yeniden gösterildi',
        data: row,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const reviewer = await User.findByPk(req.user.user_id, { attributes: ['id', 'full_name', 'email'] });
      const snapshot = await teacherRegister.deleteAnyRequest(req.params.id, actorFromRequest(req, reviewer));
      await audit.log(req, {
        action: 'delete',
        entityType: 'mobile_register_request',
        entityId: snapshot.id,
        summary: `Platform mobil kayıt isteğini sildi: ${snapshot.first_name} ${snapshot.last_name}`,
      });
      res.json({ success: true, message: 'Kayıt isteği silindi' });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },
};
