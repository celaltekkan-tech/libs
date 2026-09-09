const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/guidanceController');
const validate = require('../middlewares/validate');
const {
  createGuidanceSessionSchema,
  updateGuidanceSessionSchema,
} = require('../validators/guidanceSession.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('guidance');

router.get('/', auth, moduleGuard, permission('guidance.read'), ctrl.list);
router.get('/stats', auth, moduleGuard, permission('guidance.read'), ctrl.stats);
router.post('/', auth, moduleGuard, permission('guidance.create'), validate(createGuidanceSessionSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('guidance.update'), validate(updateGuidanceSessionSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('guidance.delete'), ctrl.remove);

module.exports = router;
