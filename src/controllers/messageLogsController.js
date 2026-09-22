'use strict';

const { Op } = require('sequelize');
const { MessageLog, MessageLogHide } = require('../models');

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;
const CHANNELS = ['sms', 'email'];
const STATUSES = ['basarili', 'basarisiz', 'iptal'];

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(req.query.pageSize, 10) || PAGE_SIZE_DEFAULT));
      const view = req.query.view === 'hidden' ? 'hidden' : 'visible';

      const hideRows = await MessageLogHide.findAll({
        where: { user_id: req.user.user_id },
        attributes: ['message_log_id'],
      });
      const hiddenIds = hideRows.map((h) => h.message_log_id);

      const where = { tenant_id: tenantId };
      if (view === 'visible') {
        if (hiddenIds.length > 0) where.id = { [Op.notIn]: hiddenIds };
      } else {
        where.id = { [Op.in]: hiddenIds.length > 0 ? hiddenIds : [0] };
      }

      if (CHANNELS.includes(req.query.channel)) where.channel = req.query.channel;
      if (STATUSES.includes(req.query.status)) where.status = req.query.status;
      if (req.query.q) {
        const term = `%${String(req.query.q).trim()}%`;
        where[Op.or] = [
          { recipient_label: { [Op.iLike]: term } },
          { recipient_contact: { [Op.iLike]: term } },
          { subject: { [Op.iLike]: term } },
          { body: { [Op.iLike]: term } },
        ];
      }

      const { rows, count } = await MessageLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      res.json({
        success: true,
        data: rows,
        pagination: { page, pageSize, total: count },
      });
    } catch (err) {
      next(err);
    }
  },

  async hide(req, res, next) {
    try {
      const row = await MessageLog.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
      if (row.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      await MessageLogHide.findOrCreate({
        where: { message_log_id: row.id, user_id: req.user.user_id },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async unhide(req, res, next) {
    try {
      const row = await MessageLog.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
      if (row.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      await MessageLogHide.destroy({ where: { message_log_id: row.id, user_id: req.user.user_id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
