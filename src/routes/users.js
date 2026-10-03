const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const validate = require('../middlewares/validate');
const {
  createUserSchema,
  updateUserSchema,
  approveMobileRegisterSchema,
  rejectMobileRegisterSchema,
  mobileRegisterVisibilitySchema,
} = require('../validators/user.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('users');

router.get(
  '/mobile-register-requests',
  auth,
  moduleGuard,
  permission('mobile_register_requests.read'),
  ctrl.listMobileRegisterRequests,
);
router.get(
  '/mobile-register-requests/roles',
  auth,
  moduleGuard,
  permission('mobile_register_requests.update'),
  ctrl.listMobileRegisterRoles,
);
router.get(
  '/mobile-register-requests/teachers',
  auth,
  moduleGuard,
  permission('mobile_register_requests.update'),
  ctrl.listMobileRegisterTeachers,
);
router.post(
  '/mobile-register-requests/:id/approve',
  auth,
  moduleGuard,
  permission('mobile_register_requests.update'),
  validate(approveMobileRegisterSchema),
  ctrl.approveMobileRegisterRequest,
);
router.post(
  '/mobile-register-requests/:id/visibility',
  auth,
  moduleGuard,
  permission('mobile_register_requests.update'),
  validate(mobileRegisterVisibilitySchema),
  ctrl.setMobileRegisterVisibility,
);
router.post(
  '/mobile-register-requests/:id/reject',
  auth,
  moduleGuard,
  permission('mobile_register_requests.update'),
  validate(rejectMobileRegisterSchema),
  ctrl.rejectMobileRegisterRequest,
);

router.get('/form-options', auth, moduleGuard, permission('users.read'), ctrl.formOptions);
router.get('/', auth, moduleGuard, permission('users.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('users.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('users.create'), validate(createUserSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('users.update'), validate(updateUserSchema), ctrl.update);
router.post('/:id/reset-sms-login', auth, moduleGuard, permission('users.update'), ctrl.resetSmsLogin);
router.delete('/:id', auth, moduleGuard, permission('users.delete'), ctrl.remove);

module.exports = router;
