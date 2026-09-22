const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/examsController');
const sorumlulukCtrl = require('../controllers/sorumlulukExamsController');
const validate = require('../middlewares/validate');
const {
  createExamSchema,
  updateExamSchema,
  exportExamSchema,
  sorumlulukImportCommitSchema,
  sorumlulukCreateSchema,
  sorumlulukScheduleSchema,
  sorumlulukUpdateSchema,
} = require('../validators/exam.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('exams');

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';
    if (!ok) return cb(new Error('Yalnızca .xls veya .xlsx dosyaları kabul edilir'));
    return cb(null, true);
  },
});

router.get('/', auth, moduleGuard, permission('exams.read'), ctrl.list);
router.post('/export', auth, moduleGuard, permission('exams.read'), validate(exportExamSchema), ctrl.exportFile);

router.get('/sorumluluk', auth, moduleGuard, permission('exams.read'), sorumlulukCtrl.list);
router.post(
  '/sorumluluk/import/preview',
  auth,
  moduleGuard,
  permission('exams.create'),
  importUpload.single('file'),
  sorumlulukCtrl.previewImport,
);
router.post(
  '/sorumluluk/import/commit',
  auth,
  moduleGuard,
  permission('exams.create'),
  validate(sorumlulukImportCommitSchema),
  sorumlulukCtrl.commitImport,
);
router.post(
  '/sorumluluk',
  auth,
  moduleGuard,
  permission('exams.create'),
  validate(sorumlulukCreateSchema),
  sorumlulukCtrl.create,
);
router.post(
  '/sorumluluk/schedule',
  auth,
  moduleGuard,
  permission('exams.create'),
  validate(sorumlulukScheduleSchema),
  sorumlulukCtrl.schedule,
);
router.post(
  '/sorumluluk/export',
  auth,
  moduleGuard,
  permission('exams.read'),
  validate(exportExamSchema),
  sorumlulukCtrl.exportFile,
);
router.delete('/sorumluluk', auth, moduleGuard, permission('exams.delete'), sorumlulukCtrl.removeAll);
router.put(
  '/sorumluluk/:id',
  auth,
  moduleGuard,
  permission('exams.update'),
  validate(sorumlulukUpdateSchema),
  sorumlulukCtrl.update,
);
router.delete('/sorumluluk/:id', auth, moduleGuard, permission('exams.delete'), sorumlulukCtrl.remove);

router.post('/', auth, moduleGuard, permission('exams.create'), validate(createExamSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('exams.update'), validate(updateExamSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('exams.delete'), ctrl.remove);

module.exports = router;
