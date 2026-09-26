const { License, Tenant } = require('../models');
const { Op } = require('sequelize');
const { isAddonPlan, isSmsPlan, isAiPlan, getSmsQuotaForPlan, getPlanCategory } = require('../config/licensePlans');
const licenseService = require('../services/licenseService');

function resolveSmsQuota(plan) {
  if (!isSmsPlan(plan)) return null;
  return getSmsQuotaForPlan(plan);
}

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

      await licenseService.attachSmsUsage(licenses);
      await licenseService.attachAiUsage(licenses);
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
      await licenseService.attachSmsUsage([license]);
      await licenseService.attachAiUsage([license]);
      res.json({ success: true, data: license });
    } catch (err) {
      next(err);
    }
  },

  // Yeni lisans yalnızca aynı kategorideki aktif lisansı iptal eder (ana / SMS / yapay zekâ).
  async create(req, res, next) {
    const payload = req.validatedBody || req.body;
    const transaction = await License.sequelize.transaction();

    try {
      const tenant = await Tenant.findByPk(payload.tenant_id, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const creatingAddon = isAddonPlan(payload.plan);
      if (creatingAddon) {
        const actives = await License.findAll({
          where: {
            tenant_id: payload.tenant_id,
            status: 'active',
            [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: new Date() } }],
          },
          transaction,
        });
        const hasMain = actives.some((row) => !isAddonPlan(row.plan));
        if (!hasMain) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            code: 'MAIN_LICENSE_REQUIRED',
            message: 'Eklenti lisansı vermek için hesabın aktif bir ana lisansı olmalıdır.',
          });
        }
      }

      const activesToReplace = await License.findAll({
        where: { tenant_id: payload.tenant_id, status: 'active' },
        transaction,
      });
      const category = getPlanCategory(payload.plan);
      const idsToCancel = activesToReplace
        .filter((row) => getPlanCategory(row.plan) === category)
        .map((row) => row.id);

      if (idsToCancel.length > 0) {
        await License.update(
          { status: 'cancelled', cancelled_at: new Date() },
          { where: { id: idsToCancel }, transaction }
        );
      }

      const license = await License.create(
        {
          tenant_id: payload.tenant_id,
          plan: payload.plan,
          starts_at: payload.starts_at || new Date(),
          ends_at: payload.ends_at || null,
          notes: payload.notes || null,
          sms_quota: resolveSmsQuota(payload.plan),
          sms_used: 0,
          ai_daily_limit: isAiPlan(payload.plan) ? payload.ai_daily_limit ?? null : null,
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

  async updateAiLimit(req, res, next) {
    try {
      const license = await License.findByPk(req.params.id);
      if (!license) return res.status(404).json({ success: false, message: 'Lisans bulunamadı' });
      if (!isAiPlan(license.plan)) {
        return res.status(400).json({ success: false, message: 'Günlük sınır yalnızca Yapay Zekâ eklentisinde tanımlanır' });
      }
      await license.update({ ai_daily_limit: req.validatedBody.ai_daily_limit });
      await licenseService.attachAiUsage([license]);
      res.json({ success: true, data: license });
    } catch (err) {
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
