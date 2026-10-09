const mailbox = require('../services/mailboxService');

function folderOf(req) {
  const fromBody = req.validatedBody && req.validatedBody.folder;
  return String(req.query.folder || fromBody || 'INBOX').trim() || 'INBOX';
}

function uidOf(req) {
  const uid = Number(req.params.uid);
  if (!Number.isInteger(uid) || uid < 1) {
    const err = new Error('Geçersiz ileti');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return uid;
}

module.exports = {
  async status(req, res, next) {
    try {
      res.json({ success: true, data: await mailbox.status() });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const data = await mailbox.listMessages({
        folder: folderOf(req),
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const data = await mailbox.getMessage({ folder: folderOf(req), uid: uidOf(req) });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async attachment(req, res, next) {
    try {
      const file = await mailbox.getAttachment({
        folder: folderOf(req),
        uid: uidOf(req),
        index: req.params.index,
      });
      res.setHeader('Content-Type', file.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      );
      res.send(file.content);
    } catch (err) {
      next(err);
    }
  },

  async send(req, res, next) {
    try {
      const { to, cc, subject, text } = req.validatedBody;
      const data = await mailbox.sendMessage({ to, cc, subject, text });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async seen(req, res, next) {
    try {
      const data = await mailbox.setSeen({
        folder: folderOf(req),
        uid: uidOf(req),
        seen: req.validatedBody.seen,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const data = await mailbox.deleteMessage({ folder: folderOf(req), uid: uidOf(req) });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
