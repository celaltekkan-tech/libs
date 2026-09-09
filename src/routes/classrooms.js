const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/classroomsController');
const validate = require('../middlewares/validate');
const {
  createClassroomSchema,
  updateClassroomSchema,
  exportClassroomSchema,
} = require('../validators/classroom.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('classrooms');

router.get('/', auth, moduleGuard, permission('classrooms.read'), ctrl.list);
router.post('/export', auth, moduleGuard, permission('classrooms.read'), validate(exportClassroomSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('classrooms.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('classrooms.create'), validate(createClassroomSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('classrooms.update'), validate(updateClassroomSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('classrooms.delete'), ctrl.remove);

module.exports = router;
