const { User } = require('../models');

/**
 * Tenant'lar üstü işlemler (hesap oluşturma/yönetimi) için yetki kontrolü.
 * Tenant-scoped `permission`/`checkRole` middleware'lerinden bağımsızdır.
 */
module.exports = async (req, res, next) => {
  try {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_MISSING',
        message: 'Yetkilendirme gerekli',
      });
    }

    const user = await User.findByPk(req.user.user_id);
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Kullanıcı bulunamadı',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Hesabınız pasif durumda',
      });
    }

    if (!user.is_platform_admin) {
      return res.status(403).json({
        success: false,
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Bu işlem için platform yöneticisi yetkisi gerekir',
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
