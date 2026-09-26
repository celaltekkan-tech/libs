'use strict';

const crypto = require('crypto');

function configuredSecret() {
  const secret = String(process.env.FEEDBACK_SYNC_SECRET || '');
  if (secret.length < 16) return '';
  return secret;
}

function tokensMatch(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Karşı ortamın makine hesabı. Paylaşılan anahtar iki tarafta da aynı olmalıdır. */
module.exports = function feedbackSyncAuth(req, res, next) {
  const secret = configuredSecret();
  if (!secret) {
    return res.status(503).json({
      success: false,
      code: 'SYNC_DISABLED',
      message: 'Geri bildirim senkronu bu ortamda kapalı',
    });
  }

  const provided = req.get('X-Feedback-Sync-Token') || '';
  if (!provided || !tokensMatch(provided, secret)) {
    return res.status(401).json({
      success: false,
      code: 'SYNC_UNAUTHORIZED',
      message: 'Senkron anahtarı geçersiz',
    });
  }

  return next();
};
