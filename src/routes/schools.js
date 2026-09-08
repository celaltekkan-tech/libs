const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/schoolsController');
const validate = require('../middlewares/validate');
const { createSchoolSchema, updateSchoolSchema } = require('../validators/school.validator');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

router.get('/', auth, permission('schools.read'), ctrl.list);
router.get('/:id', auth, permission('schools.read'), ctrl.get);
router.post('/', auth, permission('schools.create'), validate(createSchoolSchema), ctrl.create);
router.put('/:id', auth, permission('schools.update'), validate(updateSchoolSchema), ctrl.update);
router.delete('/:id', auth, permission('schools.delete'), ctrl.remove);

module.exports = router;
