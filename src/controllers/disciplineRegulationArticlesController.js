'use strict';

const { Op } = require('sequelize');
const { DisciplineRegulationArticle } = require('../models');

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const rows = await DisciplineRegulationArticle.findAll({
        where: { [Op.or]: [{ tenant_id: null }, { tenant_id: tenantId || -1 }] },
        order: [['source', 'ASC'], ['article_no', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      payload.tenant_id = req.user && req.user.tenant_id;
      payload.source = 'custom';
      const row = await DisciplineRegulationArticle.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await DisciplineRegulationArticle.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (row.source !== 'custom' || row.tenant_id !== (req.user && req.user.tenant_id)) {
        return res.status(403).json({ success: false, message: 'Bu madde silinemez' });
      }
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
