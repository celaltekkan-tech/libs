const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/teachersController');
const promotionsCtrl = require('../controllers/promotionsController');
const validate = require('../middlewares/validate');
const {
  createTeacherSchema,
  updateTeacherSchema,
  exportTeacherSchema,
  importMebbisCommitSchema,
} = require('../validators/teacher.validator');
const { applyPromotionSchema } = require('../validators/promotionHistory.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', auth, moduleGuard, permission('teachers.read'), ctrl.list);
router.get('/promotions/upcoming', auth, moduleGuard, permission('teachers.read'), ctrl.upcomingPromotions);
router.get(
  '/promotions/salary-form/export',
  auth,
  moduleGuard,
  permission('norm_positions.read'),
  promotionsCtrl.exportSalaryForm,
);
router.get(
  '/promotions/:historyId/export-form',
  auth,
  moduleGuard,
  permission('teachers.read'),
  promotionsCtrl.exportPromotionForm,
);
router.post('/export', auth, moduleGuard, permission('teachers.read'), validate(exportTeacherSchema), ctrl.exportFile);
router.post(
  '/import/mebbis/preview',
  auth,
  moduleGuard,
  permission('teachers.create'),
  importUpload.single('file'),
  ctrl.importMebbisPreview,
);
router.post(
  '/import/mebbis/commit',
  auth,
  moduleGuard,
  permission('teachers.create'),
  validate(importMebbisCommitSchema),
  ctrl.importMebbisCommit,
);
router.get('/:id', auth, moduleGuard, permission('teachers.read'), ctrl.get);
router.get('/:id/document', auth, moduleGuard, permission('teachers.read'), ctrl.document);
router.get('/:id/promotions', auth, moduleGuard, permission('teachers.read'), promotionsCtrl.listHistory);
router.post(
  '/:id/promotions',
  auth,
  moduleGuard,
  permission('teachers.update'),
  validate(applyPromotionSchema),
  promotionsCtrl.applyPromotion,
);
router.post('/', auth, moduleGuard, permission('teachers.create'), validate(createTeacherSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('teachers.update'), validate(updateTeacherSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('teachers.delete'), ctrl.remove);

module.exports = router;
