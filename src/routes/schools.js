const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/schoolsController');
const validate = require('../middlewares/validate');
const { createSchoolSchema, updateSchoolSchema } = require('../validators/school.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');
const schoolLogoUpload = require('../services/schoolLogoUpload');

const moduleGuard = requireModule('schools');

function handleLogoMulterError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: 'Logo en fazla 2 MB olabilir',
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

router.get('/', auth, moduleGuard, permission('schools.read'), ctrl.list);
router.get('/:id/logo', auth, ctrl.getLogo);
router.post(
  '/:id/logo',
  auth,
  moduleGuard,
  permission('schools.update'),
  (req, res, next) => {
    schoolLogoUpload.upload.single('logo')(req, res, (err) => handleLogoMulterError(err, req, res, next));
  },
  ctrl.uploadLogo
);
router.delete('/:id/logo', auth, moduleGuard, permission('schools.update'), ctrl.removeLogo);
router.get('/:id', auth, moduleGuard, permission('schools.read'), ctrl.get);
router.post('/', auth, moduleGuard, permission('schools.create'), validate(createSchoolSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('schools.update'), validate(updateSchoolSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('schools.delete'), ctrl.remove);

module.exports = router;
