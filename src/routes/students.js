const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/studentsController');
const validate = require('../middlewares/validate');
const {
  createStudentSchema,
  updateStudentSchema,
  exportStudentSchema,
} = require('../validators/student.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');
const photoUpload = require('../services/studentPhotoUpload');

const moduleGuard = requireModule('students');
const upload = multer({
  storage: multer.memoryStorage(),
  // E-Okul'un gömülü fotoğraflı öğrenci dökümleri normal Excel dosyalarından çok daha
  // büyük olabildiğinden (aynı buton her iki dosya türünü de kabul eder), limit geniş tutulur.
  limits: { fileSize: 40 * 1024 * 1024 },
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

function handlePhotoMulterError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: 'Fotoğraf en fazla 3 MB olabilir',
    });
  }
  if (err.status === 400 || err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      code: err.code || 'INVALID_FILE_TYPE',
      message: err.message,
    });
  }
  return next(err);
}

router.get('/', auth, moduleGuard, permission('students.read'), ctrl.list);
router.post(
  '/import/preview',
  auth,
  moduleGuard,
  permission('students.create'),
  upload.single('file'),
  ctrl.previewImport
);
router.post('/import', auth, moduleGuard, permission('students.create'), upload.single('file'), ctrl.importExcel);
router.post('/export', auth, moduleGuard, permission('students.read'), validate(exportStudentSchema), ctrl.exportFile);
router.get('/lookup/:number', auth, moduleGuard, permission('students.read'), ctrl.lookupByNumber);
router.get('/:id/photo', auth, moduleGuard, permission('students.read'), ctrl.getPhoto);
router.post(
  '/:id/photo',
  auth,
  moduleGuard,
  permission('students.update'),
  (req, res, next) => {
    photoUpload.upload.single('photo')(req, res, (err) => handlePhotoMulterError(err, req, res, next));
  },
  ctrl.uploadPhoto
);
router.get('/:id', auth, moduleGuard, permission('students.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('students.create'), validate(createStudentSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('students.update'), validate(updateStudentSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('students.delete'), ctrl.remove);

module.exports = router;
