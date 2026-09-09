const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/exportTemplatesController');
const validate = require('../middlewares/validate');
const { createExportTemplateSchema } = require('../validators/exportTemplate.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

// Şu an yalnızca entity_type: 'students' destekleniyor; bu yüzden students
// modülü/izinleri üzerinden yetkilendirilir.
const moduleGuard = requireModule('students');

router.get('/', auth, moduleGuard, permission('students.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('students.create'), validate(createExportTemplateSchema), ctrl.create);
router.delete('/:id', auth, moduleGuard, permission('students.create'), ctrl.remove);

module.exports = router;
