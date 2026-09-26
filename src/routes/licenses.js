const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/licensesController');
const validate = require('../middlewares/validate');
const { createLicenseSchema, updateAiLimitSchema } = require('../validators/license.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

// Lisans tanımlama/iptal etme sadece platform yöneticisinin yetkisindedir
router.get('/', auth, platformAdmin, ctrl.list);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.post('/', auth, platformAdmin, validate(createLicenseSchema), ctrl.create);
router.put('/:id/cancel', auth, platformAdmin, ctrl.cancel);
router.put('/:id/ai-limit', auth, platformAdmin, validate(updateAiLimitSchema), ctrl.updateAiLimit);

module.exports = router;
