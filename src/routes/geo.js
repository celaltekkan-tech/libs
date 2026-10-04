const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/geoController');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');
const validate = require('../middlewares/validate');
const {
  createDirectorySchoolSchema,
  updateDirectorySchoolSchema,
} = require('../validators/directorySchool.validator');

router.get('/provinces', auth, ctrl.listProvinces);
router.get('/provinces/:provinceId/districts', auth, ctrl.listDistricts);
router.get('/districts', auth, ctrl.listDistricts);
router.get('/directory-schools/:id/logo', auth, ctrl.getDirectorySchoolLogo);
router.get('/directory-schools', auth, ctrl.listDirectorySchools);
router.post(
  '/directory-schools',
  auth,
  platformAdmin,
  validate(createDirectorySchoolSchema),
  ctrl.createDirectorySchool,
);
router.put(
  '/directory-schools/:id',
  auth,
  platformAdmin,
  validate(updateDirectorySchoolSchema),
  ctrl.updateDirectorySchool,
);
router.delete('/directory-schools/:id', auth, platformAdmin, ctrl.deleteDirectorySchool);

module.exports = router;
