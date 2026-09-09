const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/schoolsController');
const validate = require('../middlewares/validate');
const { createSchoolSchema, updateSchoolSchema } = require('../validators/school.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('schools');

router.get('/', auth, moduleGuard, permission('schools.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('schools.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('schools.create'), validate(createSchoolSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schools.update'), validate(updateSchoolSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schools.delete'), ctrl.remove);

module.exports = router;
