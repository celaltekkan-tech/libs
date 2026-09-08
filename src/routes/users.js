const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const validate = require('../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

router.get('/', auth, permission('users.read'), ctrl.list);
router.get('/:id', auth, permission('users.read'), ctrl.get);
router.post('/', auth, permission('users.create'), validate(createUserSchema), ctrl.create);
router.put('/:id', auth, permission('users.update'), validate(updateUserSchema), ctrl.update);
router.delete('/:id', auth, permission('users.delete'), ctrl.remove);

module.exports = router;
