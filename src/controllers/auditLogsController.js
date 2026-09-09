'use strict';

const { Op } = require('sequelize');
const { AuditLog } = require('../models');

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const where = { tenant_id: tenantId };

      if (req.query.action) where.action = req.query.action;
      if (req.query.entity_type) where.entity_type = req.query.entity_type;
      if (req.query.user_id) where.user_id = Number(req.query.user_id);

      if (req.query.q) {
        const q = `%${String(req.query.q).trim()}%`;
        where[Op.or] = [
          { summary: { [Op.iLike]: q } },
          { user_name: { [Op.iLike]: q } },
          { user_email: { [Op.iLike]: q } },
          { entity_type: { [Op.iLike]: q } },
        ];
      }

      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;

      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      res.json({
        success: true,
        data: rows,
        meta: { total: count, limit, offset },
      });
    } catch (err) {
      next(err);
    }
  },
};
