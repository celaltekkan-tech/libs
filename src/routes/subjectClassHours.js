const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subjectClassHoursController');
const validate = require('../middlewares/validate');
const { createClassHourSchema, updateClassHourSchema } = require('../validators/subjectClassHour.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('schedule');

router.get('/', auth, moduleGuard, permission('schedule.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('schedule.create'), validate(createClassHourSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schedule.update'), validate(updateClassHourSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schedule.delete'), ctrl.remove);

module.exports = router;
