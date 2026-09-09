const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const validate = require('../middlewares/validate');
const { bulkAttendanceSchema, exportAttendanceSchema } = require('../validators/attendanceRecord.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('payroll');

router.get('/', auth, moduleGuard, permission('payroll.read'), ctrl.list);
router.get('/monthly-summary', auth, moduleGuard, permission('payroll.read'), ctrl.monthlySummary);
router.post('/export', auth, moduleGuard, permission('payroll.read'), validate(exportAttendanceSchema), ctrl.exportFile);
router.post('/bulk', auth, moduleGuard, permission('payroll.create'), validate(bulkAttendanceSchema), ctrl.bulkUpsert);
router.delete('/:id', auth, moduleGuard, permission('payroll.delete'), ctrl.remove);

module.exports = router;
