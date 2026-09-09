const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/normPositionsController');
const validate = require('../middlewares/validate');
const {
  createNormPositionSchema,
  updateNormPositionSchema,
} = require('../validators/normPosition.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/', auth, moduleGuard, permission('norm_positions.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('norm_positions.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('norm_positions.create'), validate(createNormPositionSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('norm_positions.update'), validate(updateNormPositionSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('norm_positions.delete'), ctrl.remove);

module.exports = router;
