const { User } = require('../models');
const licenseService = require('../services/licenseService');
const { getModulesForPlan } = require('../config/licensePlans');

/**
 * Tenant-scoped bir modülün (schools/teachers/users) o tenant'ın planında
 * yer alıp almadığını kontrol eder. Aktif lisans yoksa 402 LICENSE_EXPIRED,
 * lisans var ama modül plana dahil değilse 403 MODULE_NOT_LICENSED döner.
 * Platform admin muaftır.
 */
module.exports = function requireModule(moduleName) {
  return async (req, res, next) => {
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

      if (user.is_platform_admin) return next();

      const activeLicense = await licenseService.getActiveLicense(user.tenant_id);
      if (!activeLicense) {
        return res.status(402).json({
          success: false,
          code: 'LICENSE_EXPIRED',
          message: 'Hesabınızın lisansı sona ermiş. Lütfen yöneticinizle iletişime geçin.',
        });
      }

      const allowedModules = getModulesForPlan(activeLicense.plan);
      if (!allowedModules.includes(moduleName)) {
        return res.status(403).json({
          success: false,
          code: 'MODULE_NOT_LICENSED',
          message: `Bu özellik "${activeLicense.plan}" planınızda bulunmuyor.`,
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
