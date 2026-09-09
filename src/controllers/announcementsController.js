'use strict';

const { Announcement, Student } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

// target_ids istemciden karışık tipte gelebilir (JSON number veya string);
// hedef sütunun gerçek tipine göre burada zorunlu olarak dönüştürülür, aksi
// halde Postgres "operator does not exist" hatası verir (varchar = integer vb.).
async function resolveRecipientCount(tenantId, targetType, targetIds) {
  const where = { tenant_id: tenantId };
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  if (targetType === 'classroom') {
    where.classroom_id = ids.map((v) => Number(v));
  } else if (targetType === 'class_level') {
    where.class_level = ids.map((v) => String(v));
  } else if (targetType === 'student') {
    where.id = ids.map((v) => Number(v));
  } else if (targetType !== 'all') {
    return 0;
  }
  return Student.count({ where });
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      const rows = await Announcement.findAll({ where, order: [['created_at', 'DESC']], limit: 500 });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      if (req.user && req.user.user_id) payload.created_by = req.user.user_id;

      const recipientCount = await resolveRecipientCount(tenantId, payload.target_type, payload.target_ids);
      payload.recipient_count = recipientCount;

      const row = await Announcement.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'announcement',
        entityId: row.id,
        summary: `Duyuru oluşturuldu: ${row.title} (${recipientCount} alıcı)`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  // Gerçek bir SMS/e-posta sağlayıcı entegrasyonu yok; bu uç yalnızca kaydı
  // "gönderildi" olarak işaretler (gönderim kuyruğu/denetim izi amaçlı).
  async markSent(req, res, next) {
    try {
      const row = await Announcement.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      if (row.status === 'gonderildi') {
        return res.status(409).json({ success: false, message: 'Bu duyuru zaten gönderildi olarak işaretli' });
      }
      await row.update({ status: 'gonderildi', sent_at: new Date() });
      await audit.log(req, {
        action: 'update',
        entityType: 'announcement',
        entityId: row.id,
        summary: `Duyuru gönderildi olarak işaretlendi: ${row.title}`,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await Announcement.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async previewRecipients(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { target_type, target_ids } = req.query;
      let parsedIds = target_ids;
      if (typeof target_ids === 'string') {
        parsedIds = target_ids.split(',').map((v) => (target_type === 'class_level' ? v : Number(v)));
      }
      const count = await resolveRecipientCount(tenantId, target_type, parsedIds);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  },
};
