const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/extraLessonsController');
const validate = require('../middlewares/validate');
const {
  createExtraLessonSchema,
  updateExtraLessonSchema,
  exportExtraLessonSchema,
} = require('../validators/extraLesson.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('payroll');

router.get('/', auth, moduleGuard, permission('payroll.read'), ctrl.list);
router.get('/suggest-lesson-load', auth, moduleGuard, permission('payroll.read'), ctrl.suggestLessonLoad);
router.get('/monthly-summary', auth, moduleGuard, permission('payroll.read'), ctrl.monthlySummary);
router.post('/export', auth, moduleGuard, permission('payroll.read'), validate(exportExtraLessonSchema), ctrl.exportFile);
router.post('/', auth, moduleGuard, permission('payroll.create'), validate(createExtraLessonSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('payroll.update'), validate(updateExtraLessonSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('payroll.delete'), ctrl.remove);

module.exports = router;
