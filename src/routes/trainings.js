const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/trainingsController');
const validate = require('../middlewares/validate');
const { createTrainingSchema, updateTrainingSchema } = require('../validators/trainingRecord.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/', auth, moduleGuard, permission('trainings.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('trainings.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('trainings.create'), validate(createTrainingSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('trainings.update'), validate(updateTrainingSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('trainings.delete'), ctrl.remove);

module.exports = router;
