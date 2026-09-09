const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parentConsentsController');
const validate = require('../middlewares/validate');
const { upsertConsentSchema } = require('../validators/parentConsent.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('communications');

router.get('/', auth, moduleGuard, permission('communications.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('communications.create'), validate(upsertConsentSchema), ctrl.upsert);

module.exports = router;
