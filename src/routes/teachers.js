const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teachersController');
const validate = require('../middlewares/validate');
const { createTeacherSchema } = require('../validators/teacher.validator');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

router.get('/', auth, permission('teachers.read'), ctrl.list);
router.get('/:id', auth, permission('teachers.read'), ctrl.get);
router.post('/', auth, permission('teachers.create'), validate(createTeacherSchema), ctrl.create);
router.put('/:id', auth, permission('teachers.update'), validate(createTeacherSchema), ctrl.update);
router.delete('/:id', auth, permission('teachers.delete'), ctrl.remove);

module.exports = router;
