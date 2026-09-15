const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/personnelCategoriesController');
const validate = require('../middlewares/validate');
const {
  createPersonnelCategorySchema,
  updatePersonnelCategorySchema,
} = require('../validators/personnelCategory.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/', auth, moduleGuard, permission('teachers.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('teachers.create'), validate(createPersonnelCategorySchema), ctrl.create);
router.put(
  '/:id',
  auth,
  moduleGuard,
  permission('teachers.update'),
  validate(updatePersonnelCategorySchema),
  ctrl.update
);
router.delete('/:id', auth, moduleGuard, permission('teachers.delete'), ctrl.remove);

module.exports = router;
