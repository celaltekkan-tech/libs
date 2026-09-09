const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leavesController');
const validate = require('../middlewares/validate');
const {
  createLeaveSchema,
  updateLeaveSchema,
  exportLeaveSchema,
} = require('../validators/leave.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('leaves');

router.get('/', auth, moduleGuard, permission('leaves.read'), ctrl.list);
router.get('/summary', auth, moduleGuard, permission('leaves.read'), ctrl.summary);
router.get('/calendar', auth, moduleGuard, permission('leaves.read'), ctrl.calendar);
router.post('/export', auth, moduleGuard, permission('leaves.read'), validate(exportLeaveSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('leaves.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('leaves.create'), validate(createLeaveSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('leaves.update'), validate(updateLeaveSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('leaves.delete'), ctrl.remove);

module.exports = router;
