const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);

router.get('/me', auth, ctrl.me);
router.put('/profile', auth, validate(updateProfileSchema), ctrl.updateProfile);
router.post('/change-password', auth, validate(changePasswordSchema), ctrl.changePassword);
router.post('/logout', auth, ctrl.logout);

module.exports = router;
