const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/holidaysController');
const validate = require('../middlewares/validate');
const { createHolidaySchema } = require('../validators/holiday.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('leaves');

router.get('/', auth, moduleGuard, permission('leaves.read'), ctrl.list);
router.post('/seed-defaults', auth, moduleGuard, permission('leaves.create'), ctrl.seedDefaults);
router.post('/', auth, moduleGuard, permission('leaves.create'), validate(createHolidaySchema), ctrl.create);
router.delete('/:id', auth, moduleGuard, permission('leaves.delete'), ctrl.remove);

module.exports = router;
