'use strict';

const { Op } = require('sequelize');
const {
  Feedback,
  FeedbackAttachment,
  FeedbackUpdate,
  Tenant,
  User,
  Notification,
  sequelize,
} = require('../models');
const {
  FEEDBACK_STATUSES,
  PENDING_FEEDBACK_STATUSES,
  OPEN_FEEDBACK_STATUSES,
  REVIEW_FEEDBACK_STATUSES,
} = require('../validators/feedback.validator');
const {
  absolutePath,
  removeStoredFile,
  serializeAttachment,
  inlineDisposition,
} = require('../services/feedbackUpload');

const attachmentInclude = {
  model: FeedbackAttachment,
  as: 'Attachments',
  attributes: ['id', 'original_name', 'mime_type', 'size_bytes', 'created_at'],
};

const updatesInclude = {
  model: FeedbackUpdate,
  as: 'Updates',
  attributes: ['id', 'body', 'is_from_platform', 'user_id', 'created_at'],
  include: [{ model: User, attributes: ['id', 'full_name'] }],
  separate: true,
  order: [['created_at', 'ASC']],
};

function parseDateStart(value) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(value) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildFeedbackWhere(query = {}, extra = {}) {
  const where = { ...extra };

  const status = query.status ? String(query.status) : null;
  if (status === 'pending') {
    where.status = { [Op.in]: PENDING_FEEDBACK_STATUSES };
  } else if (status && FEEDBACK_STATUSES.includes(status)) {
    where.status = status;
  }

  const from = parseDateStart(query.from);
  const to = parseDateEnd(query.to);
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = from;
    if (to) where.created_at[Op.lte] = to;
  }

  if (query.tenant_id) where.tenant_id = Number(query.tenant_id);

  return where;
}

module.exports = {
  async create(req, res, next) {
    const uploaded = Array.isArray(req.files) ? req.files : [];
    try {
      const payload = req.validatedBody || req.body;
      const feedback = await sequelize.transaction(async (transaction) => {
        const created = await Feedback.create(
          {
            tenant_id: req.user.tenant_id,
            user_id: req.user.user_id,
            message: payload.message,
            page_path: payload.page_path || null,
            page_title: payload.page_title || null,
          },
          { transaction }
        );

        if (uploaded.length) {
          await FeedbackAttachment.bulkCreate(
            uploaded.map((file) => ({
              feedback_id: created.id,
              original_name: file.originalname,
              stored_name: file.filename,
              mime_type: file.mimetype,
              size_bytes: file.size,
            })),
            { transaction }
          );
        }

        return Feedback.findByPk(created.id, {
          include: [
            { model: User, attributes: ['id', 'full_name'] },
            attachmentInclude,
            updatesInclude,
          ],
          transaction,
        });
      });

      res.status(201).json({ success: true, data: feedback });
    } catch (err) {
      uploaded.forEach((file) => removeStoredFile(file.filename));
      next(err);
    }
  },

  async listMine(req, res, next) {
    try {
      const where = buildFeedbackWhere(req.query, { tenant_id: req.user.tenant_id });
      const feedbacks = await Feedback.findAll({
        where,
        include: [{ model: User, attributes: ['id', 'full_name'] }, attachmentInclude, updatesInclude],
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
        limit: 200,
      });

      res.json({ success: true, data: feedbacks });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const where = buildFeedbackWhere(req.query);
      const feedbacks = await Feedback.findAll({
        where,
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: User, attributes: ['id', 'full_name', 'email'] },
          attachmentInclude,
          updatesInclude,
        ],
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
        limit: 500,
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
          attachmentInclude,
          updatesInclude,
        ],
      });
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      res.json({ success: true, data: feedback });
    } catch (err) {
      next(err);
    }
  },

  async cancelMine(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (feedback.tenant_id !== req.user.tenant_id || feedback.user_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      if (!OPEN_FEEDBACK_STATUSES.includes(feedback.status)) {
        return res.status(400).json({ success: false, message: 'Bu geri bildirim iptal edilemez' });
      }
      const { cancel_reason } = req.validatedBody || req.body;
      await feedback.update({ status: 'cancelled', cancel_reason });
      const full = await Feedback.findByPk(feedback.id, {
        include: [{ model: User, attributes: ['id', 'full_name'] }, attachmentInclude, updatesInclude],
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async addUpdate(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      const user = await User.findByPk(req.user.user_id, {
        attributes: ['id', 'is_platform_admin', 'tenant_id', 'is_active'],
      });
      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
      }

      const isPlatform = Boolean(user.is_platform_admin);
      const isOwner =
        feedback.tenant_id === user.tenant_id && feedback.user_id === user.id;

      if (!isPlatform && !isOwner) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      // Kullanıcı inceleniyor / beklemede aşamasında gelişme ekleyebilir
      if (!isPlatform && !REVIEW_FEEDBACK_STATUSES.includes(feedback.status)) {
        return res.status(400).json({
          success: false,
          message: 'Yalnızca incelenmekte olan geri bildirimlere gelişme eklenebilir',
        });
      }

      if (isPlatform && (feedback.status === 'cancelled' || feedback.status === 'resolved')) {
        return res.status(400).json({
          success: false,
          message: 'Sonuçlanmış veya iptal edilmiş kayda gelişme eklenemez',
        });
      }

      const { body } = req.validatedBody || req.body;
      await FeedbackUpdate.create({
        feedback_id: feedback.id,
        user_id: user.id,
        body,
        is_from_platform: isPlatform,
      });

      if (!isPlatform) {
        // Kullanıcı gelişmesi → beklemede
        if (feedback.status !== 'waiting') {
          await feedback.update({ status: 'waiting' });
        }
      } else if (feedback.user_id) {
        await Notification.create({
          recipient_user_id: feedback.user_id,
          tenant_id: feedback.tenant_id,
          sender_user_id: user.id,
          title: 'Geri bildiriminize yeni gelişme eklendi',
          body: 'Gönderdiğiniz geri bildirime platform tarafından yeni bir gelişme eklendi. Detay için Geri Bildirim sayfasına bakın.',
        });
        // Yönetici gelişme ekleyip henüz sonuçlandırmadıysa kayıt incelemeye döner
        if (feedback.status !== 'read') {
          await feedback.update({ status: 'read' });
        }
      }

      const include = isPlatform
        ? [
            { model: Tenant, attributes: ['id', 'name'] },
            { model: User, attributes: ['id', 'full_name', 'email'] },
            attachmentInclude,
            updatesInclude,
          ]
        : [{ model: User, attributes: ['id', 'full_name'] }, attachmentInclude, updatesInclude];

      const full = await Feedback.findByPk(feedback.id, { include });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      const payload = req.validatedBody || req.body;
      const hadReply = Boolean(feedback.reply);
      if (payload.reply !== undefined) {
        payload.replied_at = payload.reply ? new Date() : null;
      }
      await feedback.update(payload);

      if (payload.reply && !hadReply && feedback.user_id) {
        await Notification.create({
          recipient_user_id: feedback.user_id,
          tenant_id: feedback.tenant_id,
          sender_user_id: req.user.user_id,
          title: 'Geri bildiriminize yanıt verildi',
          body: 'Gönderdiğiniz geri bildirime platform tarafından yanıt verildi. Detay için Geri Bildirim sayfasına bakın.',
        });
      }

      const full = await Feedback.findByPk(feedback.id, {
        include: [
          { model: Tenant, attributes: ['id', 'name'] },
          { model: User, attributes: ['id', 'full_name', 'email'] },
          attachmentInclude,
          updatesInclude,
        ],
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const feedback = await Feedback.findByPk(req.params.id, {
        include: [{ model: FeedbackAttachment, as: 'Attachments' }],
      });
      if (!feedback) return res.status(404).json({ success: false, message: 'Bulunamadı' });

      const storedNames = (feedback.Attachments || []).map((a) => a.stored_name);
      await feedback.destroy();
      storedNames.forEach((name) => removeStoredFile(name));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async downloadAttachment(req, res, next) {
    try {
      const attachment = await FeedbackAttachment.findByPk(req.params.attachmentId, {
        include: [{ model: Feedback, attributes: ['id', 'tenant_id'] }],
      });
      if (!attachment || !attachment.Feedback) {
        return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
      }

      const user = await User.findByPk(req.user.user_id, {
        attributes: ['id', 'is_platform_admin', 'tenant_id', 'is_active'],
      });
      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
      }
      if (!user.is_platform_admin && user.tenant_id !== attachment.Feedback.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const filePath = absolutePath(attachment.stored_name);
      const disposition = inlineDisposition(attachment.mime_type);
      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`
      );
      return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  },
};
