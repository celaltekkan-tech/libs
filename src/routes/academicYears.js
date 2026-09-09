const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/academicYearsController');
const validate = require('../middlewares/validate');
const {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} = require('../validators/academicYear.validator');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

// Eğitim öğretim yılı tanımı temel sistem verisidir; roller/izinler gibi
// lisans planından bağımsız olarak tüm tenant'lara açıktır (moduleGuard yok).
router.get('/', auth, permission('academic_years.read'), ctrl.list);
router.get('/current', auth, permission('academic_years.read'), ctrl.current);
router.post('/', auth, permission('academic_years.create'), validate(createAcademicYearSchema), ctrl.create);
router.put('/:id', auth, permission('academic_years.update'), validate(updateAcademicYearSchema), ctrl.update);
router.delete('/:id', auth, permission('academic_years.delete'), ctrl.remove);

module.exports = router;
