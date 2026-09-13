const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/scheduleController');
const validate = require('../middlewares/validate');
const {
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  exportScheduleSchema,
} = require('../validators/schedule.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('schedule');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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

router.get('/', auth, moduleGuard, permission('schedule.read'), ctrl.list);
router.get('/teacher-load', auth, moduleGuard, permission('schedule.read'), ctrl.teacherLoad);
router.get('/teachers', auth, moduleGuard, permission('schedule.read'), ctrl.teachersFromSchedule);
router.get('/hours-check', auth, moduleGuard, permission('schedule.read'), ctrl.hoursCheck);
router.post(
  '/import/preview',
  auth,
  moduleGuard,
  permission('schedule.create'),
  upload.single('file'),
  ctrl.previewImport
);
router.post('/import', auth, moduleGuard, permission('schedule.create'), upload.single('file'), ctrl.importExcel);
router.post('/export', auth, moduleGuard, permission('schedule.read'), validate(exportScheduleSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('schedule.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('schedule.create'), validate(createScheduleEntrySchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schedule.update'), validate(updateScheduleEntrySchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schedule.delete'), ctrl.remove);

module.exports = router;
