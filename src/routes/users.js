const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const validate = require('../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('users');

router.get('/form-options', auth, moduleGuard, permission('users.read'), ctrl.formOptions);
router.get('/', auth, moduleGuard, permission('users.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('users.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('users.create'), validate(createUserSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('users.update'), validate(updateUserSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('users.delete'), ctrl.remove);

module.exports = router;
