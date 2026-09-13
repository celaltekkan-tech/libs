'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rolesController');
const validate = require('../middlewares/validate');
const { createRoleSchema, updateRoleSchema } = require('../validators/role.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('users');

router.get('/catalog', auth, moduleGuard, permission('users.read'), ctrl.catalog);
router.get('/', auth, moduleGuard, permission('users.read'), ctrl.list);
router.get('/:id', auth, moduleGuard, permission('users.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('users.create'), validate(createRoleSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('users.update'), validate(updateRoleSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('users.delete'), ctrl.remove);

module.exports = router;
