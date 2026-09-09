const { School, Tenant } = require('../models');
const audit = require('../services/auditService');

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      
      if (tenantId) {
        where.tenant_id = tenantId;
      }

      const schools = await School.findAll({
        where,
        include: [
          { model: Tenant, attributes: ['id', 'name'] }
        ],
        limit: 100
      });

      res.json({ success: true, data: schools });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const id = req.params.id;
      const school = await School.findByPk(id, {
        include: [
          { model: Tenant, attributes: ['id', 'name'] }
        ]
      });

      if (!school) {
        return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      res.json({ success: true, data: school });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      // tenant_id her zaman oturumdaki kullanıcının tenant'ı olarak sabitlenir;
      // client'tan gelen değer güvenilmez (cross-tenant yazmayı engeller).
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      // Tenant kontrolü
      const tenant = await Tenant.findByPk(payload.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant bulunamadı' });
      }

      // Code kontrolü
      const existingSchool = await School.findOne({ where: { code: payload.code } });
      if (existingSchool) {
        return res.status(409).json({ success: false, message: 'Bu okul kodu zaten kullanılıyor' });
      }

      // Okul oluştur
      const school = await School.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'school',
        entityId: school.id,
        summary: `Okul oluşturuldu: ${school.name}`,
      });
      res.status(201).json({ success: true, data: school });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const id = req.params.id;
      const school = await School.findByPk(id);

      if (!school) {
        return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const payload = req.validatedBody || req.body;
      // Kendi tenant'ı dışına taşınamaz.
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      // Code kontrolü (eğer güncelleniyorsa)
      if (payload.code && payload.code !== school.code) {
        const existingSchool = await School.findOne({ where: { code: payload.code } });
        if (existingSchool) {
          return res.status(409).json({ success: false, message: 'Bu okul kodu zaten kullanılıyor' });
        }
      }

      await school.update(payload);
      await audit.log(req, {
        action: 'update',
        entityType: 'school',
        entityId: school.id,
        summary: `Okul güncellendi: ${school.name}`,
      });
      res.json({ success: true, data: school });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const id = req.params.id;
      const school = await School.findByPk(id);

      if (!school) {
        return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const label = school.name;
      await school.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'school',
        entityId: id,
        summary: `Okul silindi: ${label}`,
      });
      res.json({ success: true, message: 'Okul silindi' });
    } catch (err) {
      next(err);
    }
  }
};

