'use strict';

const { User, Tenant } = require('../models');

/**
 * Geri bildirimi yalnızca platform yöneticisinin açtığı hesaplar kullanabilir.
 * Platform yöneticisi muaftır.
 */
module.exports = async function feedbackEnabled(req, res, next) {
  try {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_MISSING',
        message: 'Yetkilendirme gerekli',
      });
    }

    const user = await User.findByPk(req.user.user_id, {
      attributes: ['id', 'is_platform_admin', 'tenant_id'],
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Kullanıcı bulunamadı',
      });
    }

    if (user.is_platform_admin) return next();

    const tenant = await Tenant.findByPk(user.tenant_id, {
      attributes: ['id', 'feedback_enabled'],
    });
    if (!tenant || !tenant.feedback_enabled) {
      return res.status(403).json({
        success: false,
        code: 'FEEDBACK_DISABLED',
        message: 'Geri bildirim bu hesap için kapalı',
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
