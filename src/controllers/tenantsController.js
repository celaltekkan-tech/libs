const bcrypt = require('bcrypt');
const db = require('../models');
const { Tenant, School, User, Role, UserSchool } = db;

const MANAGER_ROLE_NAME = 'Müdür';
const BCRYPT_ROUNDS = 10;

async function countsByTenant(Model) {
  const rows = await Model.findAll({
    attributes: ['tenant_id', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
    group: ['tenant_id'],
    raw: true,
  });

  const map = new Map();
  rows.forEach((row) => map.set(row.tenant_id, Number(row.count)));
  return map;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenants = await Tenant.findAll({ order: [['id', 'ASC']] });
      const [schoolCounts, userCounts] = await Promise.all([
        countsByTenant(School),
        countsByTenant(User),
      ]);

      const data = tenants.map((tenant) => ({
        ...tenant.toJSON(),
        school_count: schoolCounts.get(tenant.id) || 0,
        user_count: userCounts.get(tenant.id) || 0,
      }));

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      res.json({ success: true, data: tenant });
    } catch (err) {
      next(err);
    }
  },

  async listSchools(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const schools = await School.findAll({
        where: { tenant_id: tenant.id },
        order: [['id', 'ASC']],
      });

      res.json({ success: true, data: schools });
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const users = await User.findAll({
        where: { tenant_id: tenant.id },
        attributes: { exclude: ['password_hash'] },
        include: [{ model: School, attributes: ['id', 'name', 'code'] }],
        order: [['id', 'ASC']],
      });

      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    const payload = req.validatedBody || req.body;

    const existingSchool = await School.findOne({ where: { code: payload.school.code } });
    if (existingSchool) {
      return res.status(409).json({ success: false, message: 'Bu okul kodu zaten kullanılıyor' });
    }

    const existingUser = await User.findOne({ where: { email: payload.admin.email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_IN_USE',
        message: 'Bu e-posta zaten kullanılıyor',
      });
    }

    const transaction = await db.sequelize.transaction();

    try {
      const tenant = await Tenant.create(
        { name: payload.tenant.name, plan: payload.tenant.plan || null },
        { transaction }
      );

      const school = await School.create(
        { tenant_id: tenant.id, name: payload.school.name, code: payload.school.code },
        { transaction }
      );

      const password_hash = await bcrypt.hash(payload.admin.password, BCRYPT_ROUNDS);
      const adminUser = await User.create(
        {
          tenant_id: tenant.id,
          school_id: school.id,
          full_name: payload.admin.full_name,
          email: payload.admin.email,
          password_hash,
          role: 'admin',
        },
        { transaction }
      );

      const managerRole = await Role.findOne({ where: { role_name: MANAGER_ROLE_NAME }, transaction });
      if (managerRole) {
        await UserSchool.create(
          { user_id: adminUser.id, school_id: school.id, role_id: managerRole.id },
          { transaction }
        );
      }

      await transaction.commit();

      const adminData = adminUser.toJSON();
      delete adminData.password_hash;

      res.status(201).json({
        success: true,
        data: { tenant, school, admin: adminData },
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const payload = req.validatedBody || req.body;
      await tenant.update(payload);

      res.json({ success: true, data: tenant });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const tenant = await Tenant.findByPk(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
      }

      const [schoolCount, userCount] = await Promise.all([
        School.count({ where: { tenant_id: tenant.id } }),
        User.count({ where: { tenant_id: tenant.id } }),
      ]);

      if (schoolCount > 0 || userCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Bu hesaba bağlı okul veya kullanıcı var, önce onları kaldırın',
        });
      }

      await tenant.destroy();
      res.json({ success: true, message: 'Hesap silindi' });
    } catch (err) {
      next(err);
    }
  },
};
