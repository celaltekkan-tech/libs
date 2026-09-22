'use strict';

const { Announcement, AnnouncementRecipient, Student } = require('../models');
const audit = require('../services/auditService');
const smsEngine = require('../services/smsEngine');
const messageLogService = require('../services/messageLogService');
const licenseService = require('../services/licenseService');

function studentFullName(student) {
  return [student.first_name, student.last_name].filter(Boolean).join(' ') || null;
}

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

// target_ids istemciden karışık tipte gelebilir (JSON number veya string);
// hedef sütunun gerçek tipine göre burada zorunlu olarak dönüştürülür, aksi
// halde Postgres "operator does not exist" hatası verir (varchar = integer vb.).
function buildRecipientWhere(tenantId, targetType, targetIds) {
  const where = { tenant_id: tenantId };
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  if (targetType === 'classroom') {
    where.classroom_id = ids.map((v) => Number(v));
  } else if (targetType === 'class_level') {
    where.class_level = ids.map((v) => String(v));
  } else if (targetType === 'student') {
    where.id = ids.map((v) => Number(v));
  } else if (targetType !== 'all') {
    return null;
  }
  return where;
}

async function resolveRecipientCount(tenantId, targetType, targetIds) {
  const where = buildRecipientWhere(tenantId, targetType, targetIds);
  if (!where) return 0;
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

      if ((payload.channel === 'sms' || payload.channel === 'both') && tenantId) {
        try {
          await licenseService.assertCanSendSms(tenantId, 1);
        } catch (err) {
          if (err instanceof licenseService.SmsLicenseError) {
            return res.status(err.status).json({
              success: false,
              code: err.code,
              message: err.message,
              ...(err.details || {}),
            });
          }
          throw err;
        }
      }

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

  // channel 'sms' veya 'both' ise hedeflenen her öğrencinin veli telefonuna
  // gerçek bir SMS gönderimi denenir (smsEngine); her alıcı için sonuç
  // AnnouncementRecipient satırına işlenir. channel yalnızca 'email' ise
  // (e-posta gönderimi henüz uygulanmadığından) duyuru sadece işaretlenir.
  async markSent(req, res, next) {
    try {
      const row = await Announcement.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      if (row.status === 'gonderildi') {
        return res.status(409).json({ success: false, message: 'Bu duyuru zaten gönderildi olarak işaretli' });
      }

      let summary = { total: 0, basarili: 0, basarisiz: 0, iptal: 0 };

      if (row.channel === 'sms' || row.channel === 'both') {
        const where = buildRecipientWhere(row.tenant_id, row.target_type, row.target_ids);
        const students = where ? await Student.findAll({ where }) : [];
        summary.total = students.length;
        const billedCount = students.filter((student) => student.parent_phone && student.parent_phone.trim()).length;
        try {
          await licenseService.assertCanSendSms(row.tenant_id, billedCount);
        } catch (err) {
          if (err instanceof licenseService.SmsLicenseError) {
            return res.status(err.status).json({
              success: false,
              code: err.code,
              message: err.message,
              ...(err.details || {}),
            });
          }
          throw err;
        }

        for (const student of students) {
          const phone = student.parent_phone && student.parent_phone.trim();
          if (!phone) {
            await AnnouncementRecipient.create({
              announcement_id: row.id,
              tenant_id: row.tenant_id,
              student_id: student.id,
              phone_number: '',
              status: smsEngine.SMS_STATUS.CANCELLED,
              error_message: 'Telefon numarası yok',
            });
            await messageLogService.record({
              tenantId: row.tenant_id,
              channel: 'sms',
              sourceModule: 'announcement',
              sourceId: row.id,
              recipientLabel: studentFullName(student),
              recipientContact: null,
              subject: row.title,
              body: row.body,
              status: smsEngine.SMS_STATUS.CANCELLED,
              error: 'Telefon numarası yok',
              sentAt: null,
            });
            summary.iptal += 1;
            continue;
          }

          const result = await smsEngine.sendSms({ phoneNumber: phone, message: row.body });
          await AnnouncementRecipient.create({
            announcement_id: row.id,
            tenant_id: row.tenant_id,
            student_id: student.id,
            phone_number: phone,
            status: result.status,
            provider: result.providerName,
            provider_message_id: result.providerMessageId,
            error_message: result.error,
            sent_at: result.status === smsEngine.SMS_STATUS.SUCCESS ? new Date() : null,
          });
          await messageLogService.record({
            tenantId: row.tenant_id,
            channel: 'sms',
            sourceModule: 'announcement',
            sourceId: row.id,
            recipientLabel: studentFullName(student),
            recipientContact: phone,
            subject: row.title,
            body: row.body,
            status: result.status,
            error: result.error,
            sentAt: result.status === smsEngine.SMS_STATUS.SUCCESS ? new Date() : null,
          });
          if (result.status === smsEngine.SMS_STATUS.SUCCESS) summary.basarili += 1;
          else if (result.status === smsEngine.SMS_STATUS.CANCELLED) summary.iptal += 1;
          else summary.basarisiz += 1;
        }
        if (summary.basarili > 0) {
          await licenseService.consumeSmsCredits(row.tenant_id, summary.basarili);
        }
      }

      const finalStatus = summary.total > 0 && summary.basarili === 0 ? 'basarisiz' : 'gonderildi';
      await row.update({ status: finalStatus, sent_at: new Date() });
      await audit.log(req, {
        action: 'update',
        entityType: 'announcement',
        entityId: row.id,
        summary: `Duyuru gönderildi: ${row.title} (${summary.basarili} başarılı, ${summary.basarisiz} başarısız, ${summary.iptal} iptal)`,
      });
      res.json({ success: true, data: row, summary });
    } catch (err) {
      if (err instanceof licenseService.SmsLicenseError) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
          ...(err.details || {}),
        });
      }
      if (err instanceof smsEngine.SmsConfigError) {
        return res.status(500).json({ success: false, message: `SMS motoru yapılandırma hatası: ${err.message}` });
      }
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
