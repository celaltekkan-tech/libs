const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplinaryCasesController');
const validate = require('../middlewares/validate');
const { createCaseSchema, updateCaseSchema } = require('../validators/disciplinaryCase.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.list);
router.get('/stats', auth, moduleGuard, permission('discipline.read'), ctrl.stats);
router.get('/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.document);
router.post('/', auth, moduleGuard, permission('discipline.create'), validate(createCaseSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('discipline.update'), validate(updateCaseSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('discipline.delete'), ctrl.remove);

module.exports = router;
