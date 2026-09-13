'use strict';

const { Op } = require('sequelize');
const { Notification, User, Tenant } = require('../models');
const audit = require('../services/auditService');

const recipientInclude = {
  model: User,
  as: 'Recipient',
  attributes: ['id', 'full_name', 'email', 'tenant_id'],
};

const senderInclude = {
  model: User,
  as: 'Sender',
  attributes: ['id', 'full_name', 'email'],
  required: false,
};

const tenantInclude = {
  model: Tenant,
  attributes: ['id', 'name'],
  required: false,
};

async function resolveRecipients({ target_type, tenant_id, user_ids, senderId }) {
  if (target_type === 'users') {
    const rows = await User.findAll({
      where: { id: { [Op.in]: user_ids }, is_active: true },
      attributes: ['id', 'tenant_id'],
    });
    return rows.map((u) => ({ user_id: u.id, tenant_id: u.tenant_id }));
  }

  if (target_type === 'tenant') {
    const rows = await User.findAll({
      where: {
        tenant_id,
        is_active: true,
        is_platform_admin: false,
        id: { [Op.ne]: senderId || 0 },
      },
      attributes: ['id', 'tenant_id'],
    });
    return rows.map((u) => ({ user_id: u.id, tenant_id: u.tenant_id }));
  }

  // all_tenants: tüm aktif tenant kullanıcıları (platform admin hariç)
  const rows = await User.findAll({
    where: {
      is_active: true,
      is_platform_admin: false,
      id: { [Op.ne]: senderId || 0 },
    },
    attributes: ['id', 'tenant_id'],
  });
  return rows.map((u) => ({ user_id: u.id, tenant_id: u.tenant_id }));
}

module.exports = {
  async listMine(req, res, next) {
    try {
      const userId = req.user.user_id;
      const unreadOnly = String(req.query.unread_only || '') === 'true';
      const where = { recipient_user_id: userId };
      if (unreadOnly) where.read_at = null;

      const rows = await Notification.findAll({
        where,
        include: [senderInclude, tenantInclude],
        order: [['created_at', 'DESC']],
        limit: 100,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async unreadCount(req, res, next) {
    try {
      const count = await Notification.count({
        where: { recipient_user_id: req.user.user_id, read_at: null },
      });
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req, res, next) {
    try {
      const row = await Notification.findByPk(req.params.id);
      if (!row || row.recipient_user_id !== req.user.user_id) {
        return res.status(404).json({ success: false, message: 'Bildirim bulunamadı' });
      }
      if (!row.read_at) {
        await row.update({ read_at: new Date() });
      }
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req, res, next) {
    try {
      await Notification.update(
        { read_at: new Date() },
        { where: { recipient_user_id: req.user.user_id, read_at: null } }
      );
      res.json({ success: true, data: { ok: true } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const senderId = req.user.user_id;
      const recipients = await resolveRecipients({
        target_type: payload.target_type,
        tenant_id: payload.tenant_id,
        user_ids: payload.user_ids || [],
        senderId,
      });

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Bildirim için uygun alıcı bulunamadı',
        });
      }

      const rows = await Notification.bulkCreate(
        recipients.map((r) => ({
          recipient_user_id: r.user_id,
          tenant_id: r.tenant_id,
          sender_user_id: senderId,
          title: payload.title,
          body: payload.body,
        }))
      );

      await audit.log(req, {
        action: 'create',
        entityType: 'notification',
        summary: `Bildirim gönderildi: "${payload.title}" (${rows.length} alıcı)`,
      });

      res.status(201).json({ success: true, data: { count: rows.length } });
    } catch (err) {
      next(err);
    }
  },

  /** Platform admin: belirli tenant kullanıcıları (bildirim hedefi seçimi) */
  async recipientOptions(req, res, next) {
    try {
      const tenantId = Number(req.query.tenant_id);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'tenant_id zorunludur' });
      }
      const rows = await User.findAll({
        where: { tenant_id: tenantId, is_active: true, is_platform_admin: false },
        attributes: ['id', 'full_name', 'email', 'tenant_id'],
        order: [['full_name', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  /** Platform admin: gönderilen bildirim özeti (son 200) */
  async listSent(req, res, next) {
    try {
      const rows = await Notification.findAll({
        where: { sender_user_id: req.user.user_id },
        include: [recipientInclude, tenantInclude],
        order: [['created_at', 'DESC']],
        limit: 200,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },
};
