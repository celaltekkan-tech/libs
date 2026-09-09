const { License, Tenant } = require('../models');

module.exports = {
  async list(req, res, next) {
    try {
      const where = {};
      if (req.query.tenant_id) where.tenant_id = req.query.tenant_id;
      if (req.query.status) where.status = req.query.status;

      const licenses = await License.findAll({
        where,
        include: [{ model: Tenant, attributes: ['id', 'name'] }],
        order: [['created_at', 'DESC']],
      });

      res.json({ success: true, data: licenses });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const license = await License.findByPk(req.params.id, {
        include: [{ model: Tenant, attributes: ['id', 'name'] }],
      });
      if (!license) return res.status(404).json({ success: false, message: 'Lisans bulunamadı' });
      res.json({ success: true, data: license });
    } catch (err) {
      next(err);
    }
  },

  // Tenant'a yeni lisans tanımlar. Halihazırda aktif bir lisans varsa önce onu iptal eder.
  async create(req, res, next) {
    const payload = req.validatedBody || req.body;
    const transaction = await License.sequelize.transaction();

    try {
      const tenant = await Tenant.findByPk(payload.tenant_id, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      await License.update(
        { status: 'cancelled', cancelled_at: new Date() },
        { where: { tenant_id: payload.tenant_id, status: 'active' }, transaction }
      );

      const license = await License.create(
        {
          tenant_id: payload.tenant_id,
          plan: payload.plan,
          starts_at: payload.starts_at || new Date(),
          ends_at: payload.ends_at || null,
          notes: payload.notes || null,
          status: 'active',
        },
        { transaction }
      );

      await transaction.commit();
      res.status(201).json({ success: true, data: license });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const license = await License.findByPk(req.params.id);
      if (!license) return res.status(404).json({ success: false, message: 'Lisans bulunamadı' });

      if (license.status === 'cancelled') {
        return res.status(409).json({ success: false, message: 'Lisans zaten iptal edilmiş' });
      }

      await license.update({ status: 'cancelled', cancelled_at: new Date() });
      res.json({ success: true, data: license });
    } catch (err) {
      next(err);
    }
  },
};
