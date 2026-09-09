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

const moduleGuard = requireModule('students');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (!ok) return cb(new Error('Yalnızca .xlsx dosyaları kabul edilir'));
    return cb(null, true);
  },
});

router.get('/', auth, moduleGuard, permission('students.read'), ctrl.list);
router.post('/import', auth, moduleGuard, permission('students.create'), upload.single('file'), ctrl.importExcel);
router.post('/export', auth, moduleGuard, permission('students.read'), validate(exportStudentSchema), ctrl.exportFile);
router.get('/:id', auth, moduleGuard, permission('students.read'), ctrl.get);
router.get('/:id/certificate', auth, moduleGuard, permission('students.read'), ctrl.certificate);
router.post('/', auth, moduleGuard, permission('students.create'), validate(createStudentSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('students.update'), validate(updateStudentSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('students.delete'), ctrl.remove);

module.exports = router;
