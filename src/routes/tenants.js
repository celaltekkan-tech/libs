const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tenantsController');
const validate = require('../middlewares/validate');
const {
  createTenantWizardSchema,
  updateTenantSchema,
  updateTenantUserSchema,
  resetTenantUserPasswordSchema,
  updateTenantSchoolSchema,
  demoResetScheduleSchema,
} = require('../validators/tenant.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.list);
router.get('/banned-users', auth, platformAdmin, ctrl.listBannedUsers);
router.get('/demo-reset', auth, platformAdmin, ctrl.demoResetStatus);
router.put(
  '/demo-reset/schedule',
  auth,
  platformAdmin,
  validate(demoResetScheduleSchema),
  ctrl.updateDemoResetSchedule
);
router.post('/demo-reset/run', auth, platformAdmin, ctrl.runDemoReset);
router.post('/demo-reset/capture', auth, platformAdmin, ctrl.captureDemoBaseline);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.get('/:id/schools', auth, platformAdmin, ctrl.listSchools);
router.put(
  '/:id/schools/:schoolId',
  auth,
  platformAdmin,
  validate(updateTenantSchoolSchema),
  ctrl.updateSchool
);
router.get('/:id/users', auth, platformAdmin, ctrl.listUsers);
router.post('/', auth, platformAdmin, validate(createTenantWizardSchema), ctrl.create);
router.put('/:id', auth, platformAdmin, validate(updateTenantSchema), ctrl.update);
router.post('/:id/reset-2fa', auth, platformAdmin, ctrl.resetTwoFactor);
router.put(
  '/:id/users/:userId',
  auth,
  platformAdmin,
  validate(updateTenantUserSchema),
  ctrl.updateUser
);
router.post('/:id/users/:userId/reset-2fa', auth, platformAdmin, ctrl.resetUserTwoFactor);
router.post(
  '/:id/users/:userId/reset-sms-login',
  auth,
  platformAdmin,
  ctrl.resetUserSmsLoginRequests
);
router.post('/:id/users/:userId/unlock-login', auth, platformAdmin, ctrl.unlockUserLogin);
router.post(
  '/:id/users/:userId/reset-password',
  auth,
  platformAdmin,
  validate(resetTenantUserPasswordSchema),
  ctrl.resetUserPassword
);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
