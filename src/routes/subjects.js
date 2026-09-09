const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subjectsController');
const validate = require('../middlewares/validate');
const {
  createSubjectSchema,
  updateSubjectSchema,
  exportSubjectSchema,
} = require('../validators/subject.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('schedule');

router.get('/', auth, moduleGuard, permission('schedule.read'), ctrl.list);
router.post('/export', auth, moduleGuard, permission('schedule.read'), validate(exportSubjectSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('schedule.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('schedule.create'), validate(createSubjectSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schedule.update'), validate(updateSubjectSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schedule.delete'), ctrl.remove);

module.exports = router;
