const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  verify2faSchema,
  confirm2faSchema,
  disable2faSchema,
  tenantTwoFactorSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/verify-2fa', validate(verify2faSchema), ctrl.verify2fa);

router.get('/me', auth, ctrl.me);
router.put('/profile', auth, validate(updateProfileSchema), ctrl.updateProfile);
router.post('/change-password', auth, validate(changePasswordSchema), ctrl.changePassword);
router.post('/logout', auth, ctrl.logout);

router.get('/2fa', auth, ctrl.get2faStatus);
router.post('/2fa/setup', auth, ctrl.setup2fa);
router.post('/2fa/confirm', auth, validate(confirm2faSchema), ctrl.confirm2fa);
router.post('/2fa/disable', auth, validate(disable2faSchema), ctrl.disable2fa);

router.get('/tenant-2fa', auth, ctrl.getTenantTwoFactorSetting);
router.put('/tenant-2fa', auth, validate(tenantTwoFactorSchema), ctrl.updateTenantTwoFactorSetting);

module.exports = router;
