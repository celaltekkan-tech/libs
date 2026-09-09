const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dutyController');
const validate = require('../middlewares/validate');
const {
  createDutyLocationSchema,
  updateDutyLocationSchema,
  createDutyAssignmentSchema,
  updateDutyAssignmentSchema,
  generateDutySchema,
  exportDutySchema,
} = require('../validators/duty.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('duty');

router.get('/locations', auth, moduleGuard, permission('duty.read'), ctrl.listLocations);
router.post('/locations', auth, moduleGuard, permission('duty.create'), validate(createDutyLocationSchema), ctrl.createLocation);
router.put('/locations/:id', auth, moduleGuard, permission('duty.update'), validate(updateDutyLocationSchema), ctrl.updateLocation);
router.delete('/locations/:id', auth, moduleGuard, permission('duty.delete'), ctrl.removeLocation);

router.get('/fairness', auth, moduleGuard, permission('duty.read'), ctrl.fairness);
router.post('/generate', auth, moduleGuard, permission('duty.create'), validate(generateDutySchema), ctrl.generate);
router.post('/export', auth, moduleGuard, permission('duty.read'), validate(exportDutySchema), ctrl.exportFile);

router.get('/', auth, moduleGuard, permission('duty.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('duty.create'), validate(createDutyAssignmentSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('duty.update'), validate(updateDutyAssignmentSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('duty.delete'), ctrl.remove);

module.exports = router;
