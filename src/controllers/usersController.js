const bcrypt = require('bcrypt');
const { User, Tenant, School } = require('../models');

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      
      if (tenantId) {
        where.tenant_id = tenantId;
      }

      const users = await User.findAll({
        where,
        attributes: { exclude: ['password_hash'] },
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: School, attributes: ['id', 'name', 'code'] }
        ],
        limit: 100
      });

      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const id = req.params.id;
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password_hash'] },
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: School, attributes: ['id', 'name', 'code'] }
        ]
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      
      // Tenant kontrolü
      const tenant = await Tenant.findByPk(payload.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant bulunamadı' });
      }

      // School kontrolü (eğer verilmişse)
      if (payload.school_id) {
        const school = await School.findByPk(payload.school_id);
        if (!school) {
          return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
        }
        if (school.tenant_id !== payload.tenant_id) {
          return res.status(403).json({ success: false, message: 'Okul bu tenant\'a ait değil' });
        }
      }

      // Email kontrolü
      const existingUser = await User.findOne({ where: { email: payload.email } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Bu email zaten kullanılıyor' });
      }

      // Şifre hash'leme
      const password_hash = await bcrypt.hash(payload.password, 10);

      // Kullanıcı oluştur
      const user = await User.create({
        tenant_id: payload.tenant_id,
        school_id: payload.school_id || null,
        full_name: payload.full_name,
        email: payload.email,
        password_hash,
        role: payload.role || 'teacher'
      });

      const userData = user.toJSON();
      delete userData.password_hash;

      res.status(201).json({ success: true, data: userData });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const id = req.params.id;
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = req.validatedBody || req.body;

      // Tenant kontrolü (eğer güncelleniyorsa)
      if (payload.tenant_id) {
        const tenant = await Tenant.findByPk(payload.tenant_id);
        if (!tenant) {
          return res.status(404).json({ success: false, message: 'Tenant bulunamadı' });
        }
      }

      // School kontrolü (eğer güncelleniyorsa)
      if (payload.school_id) {
        const school = await School.findByPk(payload.school_id);
        if (!school) {
          return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
        }
        const tenantId = payload.tenant_id || user.tenant_id;
        if (school.tenant_id !== tenantId) {
          return res.status(403).json({ success: false, message: 'Okul bu tenant\'a ait değil' });
        }
      }

      // Email kontrolü (eğer güncelleniyorsa)
      if (payload.email && payload.email !== user.email) {
        const existingUser = await User.findOne({ where: { email: payload.email } });
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'Bu email zaten kullanılıyor' });
        }
      }

      // Şifre hash'leme (eğer güncelleniyorsa)
      if (payload.password) {
        payload.password_hash = await bcrypt.hash(payload.password, 10);
        delete payload.password;
      }

      await user.update(payload);

      const userData = user.toJSON();
      delete userData.password_hash;

      res.json({ success: true, data: userData });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const id = req.params.id;
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && user.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      await user.destroy();
      res.json({ success: true, message: 'Kullanıcı silindi' });
    } catch (err) {
      next(err);
    }
  }
};

