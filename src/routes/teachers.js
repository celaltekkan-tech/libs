const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teachersController');
const validate = require('../middlewares/validate');
const { createTeacherSchema, exportTeacherSchema } = require('../validators/teacher.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/', auth, moduleGuard, permission('teachers.read'), ctrl.list);
router.get('/promotions/upcoming', auth, moduleGuard, permission('teachers.read'), ctrl.upcomingPromotions);
router.post('/export', auth, moduleGuard, permission('teachers.read'), validate(exportTeacherSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('teachers.read'), ctrl.get);
router.get('/:id/document', auth, moduleGuard, permission('teachers.read'), ctrl.document);
router.post('/', auth, moduleGuard, permission('teachers.create'), validate(createTeacherSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('teachers.update'), validate(createTeacherSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('teachers.delete'), ctrl.remove);

module.exports = router;
