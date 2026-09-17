'use strict';

const accessService = require('../services/accessService');
const calendarService = require('../services/calendar/calendarService');

function parseSourcesQuery(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) {
    return raw.flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean);
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  async sources(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access) {
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }
      const data = calendarService.listSourcesForAccess(access);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async events(req, res, next) {
    try {
      const access = req.access || (await accessService.getUserAccess(req.user.user_id));
      if (!access) {
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }
      if (!access.user?.is_active) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Hesabınız pasif durumda',
        });
      }

      const tenantId = req.user.tenant_id;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Takvim yalnızca hesap kullanıcıları için kullanılabilir',
        });
      }

      const from = String(req.query.from || '');
      const to = String(req.query.to || '');
      const sources = parseSourcesQuery(req.query.sources);

      try {
        const data = await calendarService.listEvents({
          tenantId,
          from,
          to,
          sources,
          access,
        });
        res.json({ success: true, data });
      } catch (err) {
        if (err.status) {
          return res.status(err.status).json({
            success: false,
            code: err.code || 'CALENDAR_ERROR',
            message: err.message,
          });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  },
};
