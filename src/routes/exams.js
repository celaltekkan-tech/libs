const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/examsController');
const validate = require('../middlewares/validate');
const { createExamSchema, updateExamSchema, exportExamSchema } = require('../validators/exam.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('exams');

router.get('/', auth, moduleGuard, permission('exams.read'), ctrl.list);
router.post('/export', auth, moduleGuard, permission('exams.read'), validate(exportExamSchema), ctrl.exportFile);
router.post('/', auth, moduleGuard, permission('exams.create'), validate(createExamSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('exams.update'), validate(updateExamSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('exams.delete'), ctrl.remove);

module.exports = router;
