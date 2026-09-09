const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/scheduleController');
const validate = require('../middlewares/validate');
const {
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  exportScheduleSchema,
} = require('../validators/schedule.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('schedule');

router.get('/', auth, moduleGuard, permission('schedule.read'), ctrl.list);
router.get('/teacher-load', auth, moduleGuard, permission('schedule.read'), ctrl.teacherLoad);
router.get('/hours-check', auth, moduleGuard, permission('schedule.read'), ctrl.hoursCheck);
router.post('/export', auth, moduleGuard, permission('schedule.read'), validate(exportScheduleSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('schedule.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('schedule.create'), validate(createScheduleEntrySchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schedule.update'), validate(updateScheduleEntrySchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schedule.delete'), ctrl.remove);

module.exports = router;
