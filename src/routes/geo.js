const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/geoController');
const auth = require('../middlewares/auth');

router.get('/provinces', auth, ctrl.listProvinces);
router.get('/provinces/:provinceId/districts', auth, ctrl.listDistricts);
router.get('/districts', auth, ctrl.listDistricts);
router.get('/directory-schools/:id/logo', auth, ctrl.getDirectorySchoolLogo);
router.get('/directory-schools', auth, ctrl.listDirectorySchools);

module.exports = router;
