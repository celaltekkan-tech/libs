const smsEngine = require('../services/smsEngine');
const { User } = require('../models');

// Platform SMS test gönderimleri kalıcı tabloya yazılmaz ve lisans SMS
// kotasından düşmez; süreç yeniden başlayana kadar son kayıtlar bellekte tutulur.
const HISTORY_LIMIT = 30;
const history = [];

module.exports = {
  async get(req, res, next) {
    try {
      res.json({ success: true, data: { config: smsEngine.getSmsConfigSummary(), history } });
    } catch (err) {
      next(err);
    }
  },

  async send(req, res, next) {
    try {
      const { phone, message } = req.body;
      const started = Date.now();
      let result;
      try {
        result = await smsEngine.sendSms({ phoneNumber: phone, message });
      } catch (err) {
        if (!(err instanceof smsEngine.SmsConfigError)) throw err;
        result = { status: smsEngine.SMS_STATUS.FAILED, providerName: null, providerMessageId: null, error: `Yapılandırma hatası: ${err.message}` };
      }

      const user = await User.findByPk(req.user.user_id, { attributes: ['full_name', 'email'] });
      const entry = {
        id: `${started}-${Math.random().toString(36).slice(2, 8)}`,
        sent_at: new Date(started).toISOString(),
        duration_ms: Date.now() - started,
        phone: smsEngine.toE164Tr(phone),
        message,
        status: result.status,
        provider: result.providerName,
        provider_message_id: result.providerMessageId,
        error: result.error,
        sent_by: user ? user.full_name || user.email : null,
      };
      history.unshift(entry);
      history.length = Math.min(history.length, HISTORY_LIMIT);

      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  },
};
