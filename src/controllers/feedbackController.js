const { Feedback, Tenant, User } = require('../models');

module.exports = {
  async create(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const feedback = await Feedback.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.user_id,
        message: payload.message,
      });
      res.status(201).json({ success: true, data: feedback });
    } catch (err) {
      next(err);
    }
  },

  // Platform admin: tüm tenant'lara ait geri bildirimleri listeler
  async list(req, res, next) {
    try {
      const where = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.tenant_id) where.tenant_id = req.query.tenant_id;

      const feedbacks = await Feedback.findAll({
        where,
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: User, attributes: ['id', 'full_name', 'email'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 200,
      });

      res.json({ success: true, data: feedbacks });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id, {
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: User, attributes: ['id', 'full_name', 'email'] },
        ],
      });
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      res.json({ success: true, data: feedback });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      const payload = req.validatedBody || req.body;
      await feedback.update(payload);
      res.json({ success: true, data: feedback });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      await feedback.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
