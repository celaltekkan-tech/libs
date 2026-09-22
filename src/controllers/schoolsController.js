const { School, Tenant, Province, District, sequelize } = require('../models');
const audit = require('../services/auditService');
const licenseService = require('../services/licenseService');
const { applyDirectorySchoolToPayload } = require('../services/directorySchoolService');
const schoolLogoUpload = require('../services/schoolLogoUpload');
const { GLOBAL_ADMIN_ROLES } = require('../services/accessService');
const { getSchoolLimitForPlan, canAssignSchoolCode } = require('../config/licensePlans');
const { isValidSchoolCode, generateUniqueSchoolCode, SCHOOL_CODE_MESSAGE } = require('../utils/schoolCode');

async function getTenantSchoolQuota(tenantId) {
  const activeLicense = await licenseService.getActiveLicense(tenantId);
  const plan = activeLicense?.plan || null;
  const limit = getSchoolLimitForPlan(plan);
  const count = await School.count({ where: { tenant_id: tenantId } });
  return {
    plan,
    limit,
    count,
    remaining: limit == null ? null : Math.max(0, limit - count),
  };
}

function userCanAssignSchoolCode(req, plan) {
  if (GLOBAL_ADMIN_ROLES.includes(req.user && req.user.role)) return true;
  return canAssignSchoolCode(plan);
}

function assertTenantAccess(req, school) {
  if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) {
    return false;
  }
  return true;
}

function logoUrlFor(school) {
  return school.logo_path ? `/api/schools/${school.id}/logo` : null;
}

function serializeSchool(school) {
  const json = typeof school.toJSON === 'function' ? school.toJSON() : school;
  return { ...json, logo_url: logoUrlFor(school) };
}

async function isSchoolCodeTaken(code, excludeId) {
  const existing = await School.findOne({ where: { code } });
  return Boolean(existing && existing.id !== excludeId);
}

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
          { model: Tenant, attributes: ['id', 'name'] },
          { model: Province, attributes: ['id', 'name'] },
          { model: District, attributes: ['id', 'name'] },
        ],
        limit: 100
      });

      res.json({ success: true, data: schools.map(serializeSchool) });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const id = req.params.id;
      const school = await School.findByPk(id, {
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: Province, attributes: ['id', 'name'] },
          { model: District, attributes: ['id', 'name'] },
        ]
      });

      if (!school) {
        return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      }

      // Tenant kontrolü
      if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      res.json({ success: true, data: serializeSchool(school) });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      delete payload.logo_path;
      // tenant_id her zaman oturumdaki kullanıcının tenant'ı olarak sabitlenir;
      // client'tan gelen değer güvenilmez (cross-tenant yazmayı engeller).
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      // Tenant kontrolü
      const tenant = await Tenant.findByPk(payload.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant bulunamadı' });
      }

      const quota = await getTenantSchoolQuota(payload.tenant_id);
      if (quota.limit != null && quota.count >= quota.limit) {
        return res.status(403).json({
          success: false,
          code: 'SCHOOL_LIMIT_REACHED',
          message: `"${quota.plan || 'Mevcut'}" planında en fazla ${quota.limit} okul oluşturulabilir. Limit doldu (${quota.count}/${quota.limit}).`,
        });
      }

      try {
        await applyDirectorySchoolToPayload(payload);
      } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, message: err.message });
        throw err;
      }

      if (!isValidSchoolCode(payload.code)) {
        if (userCanAssignSchoolCode(req, quota.plan)) {
          return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: SCHOOL_CODE_MESSAGE,
          });
        }
        payload.code = await generateUniqueSchoolCode((code) => isSchoolCodeTaken(code));
      }

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
      res.status(201).json({ success: true, data: serializeSchool(school) });
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
      delete payload.logo_path;
      // Kendi tenant'ı dışına taşınamaz.
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;

      try {
        await applyDirectorySchoolToPayload(payload);
      } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, message: err.message });
        throw err;
      }

      const quota = await getTenantSchoolQuota(school.tenant_id);
      if (payload.code !== undefined) {
        if (!userCanAssignSchoolCode(req, quota.plan)) {
          delete payload.code;
        } else if (!isValidSchoolCode(payload.code)) {
          return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: SCHOOL_CODE_MESSAGE,
          });
        } else if (payload.code !== school.code) {
          const existingSchool = await School.findOne({ where: { code: payload.code } });
          if (existingSchool) {
            return res.status(409).json({ success: false, message: 'Bu okul kodu zaten kullanılıyor' });
          }
        }
      }

      await school.update(payload);
      await audit.log(req, {
        action: 'update',
        entityType: 'school',
        entityId: school.id,
        summary: `Okul güncellendi: ${school.name}`,
      });
      res.json({ success: true, data: serializeSchool(school) });
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
      const previousLogo = school.logo_path;
      try {
        await sequelize.transaction(async (transaction) => {
          const siblings = await School.findAll({
            where: { tenant_id: school.tenant_id },
            attributes: ['id'],
            lock: transaction.LOCK.UPDATE,
            transaction,
          });
          if (siblings.length <= 1) {
            const err = new Error('Hesapta en az bir okul bulunmalıdır. Son okulu silemezsiniz.');
            err.status = 409;
            err.code = 'LAST_SCHOOL';
            throw err;
          }
          await school.destroy({ transaction });
        });
      } catch (err) {
        if (err.status === 409) {
          return res.status(409).json({ success: false, code: err.code, message: err.message });
        }
        throw err;
      }
      if (previousLogo) schoolLogoUpload.removeStoredFile(previousLogo);
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
  },

  async getLogo(req, res, next) {
    try {
      const school = await School.findByPk(req.params.id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      if (!assertTenantAccess(req, school)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      if (!school.logo_path) {
        return res.status(404).json({ success: false, message: 'Logo bulunamadı' });
      }
      const filePath = schoolLogoUpload.absolutePath(school.logo_path);
      res.setHeader('Content-Type', schoolLogoUpload.mimeTypeFor(school.logo_path));
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(filePath, (err) => {
        if (err) next(err);
      });
    } catch (err) {
      next(err);
    }
  },

  async uploadLogo(req, res, next) {
    try {
      const school = await School.findByPk(req.params.id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      if (!assertTenantAccess(req, school)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Logo dosyası gerekli' });
      }

      const previousPath = school.logo_path;
      const storedName = schoolLogoUpload.saveBuffer(school.id, req.file);
      await school.update({ logo_path: storedName });
      if (previousPath) schoolLogoUpload.removeStoredFile(previousPath);

      await audit.log(req, {
        action: 'update',
        entityType: 'school_logo',
        entityId: school.id,
        summary: `Okul logosu güncellendi: ${school.name}`,
      });

      res.json({ success: true, data: { logo_url: logoUrlFor(school) } });
    } catch (err) {
      next(err);
    }
  },

  async removeLogo(req, res, next) {
    try {
      const school = await School.findByPk(req.params.id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      if (!assertTenantAccess(req, school)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const previousPath = school.logo_path;
      if (previousPath) {
        await school.update({ logo_path: null });
        schoolLogoUpload.removeStoredFile(previousPath);
        await audit.log(req, {
          action: 'update',
          entityType: 'school_logo',
          entityId: school.id,
          summary: `Okul logosu kaldırıldı: ${school.name}`,
        });
      }
      res.json({ success: true, data: { logo_url: null } });
    } catch (err) {
      next(err);
    }
  },
};

