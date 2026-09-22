const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplineBehaviorPointsController');
const validate = require('../middlewares/validate');
const { createBehaviorPointSchema, updateBehaviorPointSchema } = require('../validators/disciplineBehaviorPoint.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.list);
router.get('/summary', auth, moduleGuard, permission('discipline.read'), ctrl.summary);
router.post('/', auth, moduleGuard, permission('discipline.update'), validate(createBehaviorPointSchema), ctrl.create);
router.patch('/:id', auth, moduleGuard, permission('discipline.update'), validate(updateBehaviorPointSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('discipline.delete'), ctrl.remove);

module.exports = router;
