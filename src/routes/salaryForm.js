const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salaryFormController');
const validate = require('../middlewares/validate');
const { upsertSalaryFormDraftSchema, appendSalaryFormRowSchema } = require('../validators/salaryForm.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/draft', auth, moduleGuard, permission.any(['norm_positions.read', 'teachers.read']), ctrl.getDraft);
router.put(
  '/draft',
  auth,
  moduleGuard,
  permission.any(['norm_positions.update', 'teachers.update']),
  validate(upsertSalaryFormDraftSchema),
  ctrl.upsertDraft
);
router.get('/export', auth, moduleGuard, permission.any(['norm_positions.read', 'teachers.read']), ctrl.export);
router.post(
  '/draft/append',
  auth,
  moduleGuard,
  permission.any(['norm_positions.update', 'teachers.update']),
  validate(appendSalaryFormRowSchema),
  ctrl.appendDraftRow
);

module.exports = router;
