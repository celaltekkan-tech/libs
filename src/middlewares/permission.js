const accessService = require('../services/accessService');

function unauthenticated(res) {
  return res.status(401).json({
    success: false,
    code: 'TOKEN_MISSING',
    message: 'Yetkilendirme gerekli',
  });
}

/**
 * İzin kontrolü yapan middleware.
 * @param {string|string[]} requiredPermissions - Gerekli izin anahtar(lar)ı
 */
function permissionMiddleware(requiredPermissions, mode) {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) return unauthenticated(res);

      const access = await accessService.getUserAccess(req.user.user_id);
      if (!access) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Kullanıcı bulunamadı',
        });
      }

      if (!access.user.is_active) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Hesabınız pasif durumda',
        });
      }

      req.access = access;

      const matched = required.filter((perm) => access.permissions.includes(perm));
      const allowed = mode === 'any' ? matched.length > 0 : matched.length === required.length;
      if (!allowed) {
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'Bu işlem için yetkiniz yok',
          required,
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = (requiredPermissions) => permissionMiddleware(requiredPermissions, 'all');
module.exports.any = (requiredPermissions) => permissionMiddleware(requiredPermissions, 'any');

/**
 * Rol kontrolü yapan middleware. Hem global rol (admin, supervisor) hem de
 * okul bazlı rol adları (Müdür, Memur vb.) kabul edilir.
 * @param {string|string[]} requiredRoles - Gerekli rol(ler)
 */
module.exports.checkRole = (requiredRoles) => {
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) return unauthenticated(res);

      const access = await accessService.getUserAccess(req.user.user_id);
      if (!access) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Kullanıcı bulunamadı',
        });
      }

      if (!access.user.is_active) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'Hesabınız pasif durumda',
        });
      }

      req.access = access;

      const ownedRoles = [access.user.role, ...access.roles];
      const hasRole = required.some((role) => ownedRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_DENIED',
          message: 'Bu işlem için yetkiniz yok',
          required,
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
