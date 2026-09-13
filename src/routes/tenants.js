const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tenantsController');
const validate = require('../middlewares/validate');
const { createTenantWizardSchema, updateTenantSchema } = require('../validators/tenant.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.list);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.get('/:id/schools', auth, platformAdmin, ctrl.listSchools);
router.get('/:id/users', auth, platformAdmin, ctrl.listUsers);
router.post('/', auth, platformAdmin, validate(createTenantWizardSchema), ctrl.create);
router.put('/:id', auth, platformAdmin, validate(updateTenantSchema), ctrl.update);
router.post('/:id/reset-2fa', auth, platformAdmin, ctrl.resetTwoFactor);
router.post('/:id/users/:userId/reset-2fa', auth, platformAdmin, ctrl.resetUserTwoFactor);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
