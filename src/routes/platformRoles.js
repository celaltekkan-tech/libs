'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rolesController');
const validate = require('../middlewares/validate');
const { createRoleSchema, updateRoleSchema } = require('../validators/role.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/catalog', auth, platformAdmin, ctrl.catalog);
router.get('/', auth, platformAdmin, ctrl.listSystem);
router.post('/', auth, platformAdmin, validate(createRoleSchema), ctrl.createSystem);
router.put('/:id', auth, platformAdmin, validate(updateRoleSchema), ctrl.updateSystem);
router.delete('/:id', auth, platformAdmin, ctrl.removeSystem);

module.exports = router;
