const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/absencesController');
const validate = require('../middlewares/validate');
const { bulkAbsenceSchema, exportAbsenceSchema } = require('../validators/studentAbsence.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('attendance');

router.get('/', auth, moduleGuard, permission('attendance.read'), ctrl.list);
router.get('/warnings', auth, moduleGuard, permission('attendance.read'), ctrl.warnings);
router.get('/warning-letter/:studentId', auth, moduleGuard, permission('attendance.read'), ctrl.warningLetter);
router.post('/export', auth, moduleGuard, permission('attendance.read'), validate(exportAbsenceSchema), ctrl.exportFile);
router.post('/bulk', auth, moduleGuard, permission('attendance.create'), validate(bulkAbsenceSchema), ctrl.bulkCreate);
router.delete('/:id', auth, moduleGuard, permission('attendance.delete'), ctrl.remove);

module.exports = router;
