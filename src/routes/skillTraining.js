const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/skillTrainingController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');
const {
  businessSchema,
  updateBusinessSchema,
  placementSchema,
  updatePlacementSchema,
  supportSchema,
  generateSupportSchema,
  sgkSchema,
  prepareSgkSchema,
} = require('../validators/skillTraining.validator');

router.get('/businesses', auth, permission('skill_training.read'), ctrl.listBusinesses);
router.post('/businesses', auth, permission('skill_training.create'), validate(businessSchema), ctrl.createBusiness);
router.put('/businesses/:id', auth, permission('skill_training.update'), validate(updateBusinessSchema), ctrl.updateBusiness);
router.delete('/businesses/:id', auth, permission('skill_training.delete'), ctrl.removeBusiness);

router.get('/placements', auth, permission('skill_training.read'), ctrl.listPlacements);
router.post('/placements', auth, permission('skill_training.create'), validate(placementSchema), ctrl.createPlacement);
router.put('/placements/:id', auth, permission('skill_training.update'), validate(updatePlacementSchema), ctrl.updatePlacement);
router.delete('/placements/:id', auth, permission('skill_training.delete'), ctrl.removePlacement);

router.get('/supports', auth, permission('skill_training.read'), ctrl.listSupports);
router.post('/supports/generate', auth, permission('skill_training.create'), validate(generateSupportSchema), ctrl.generateSupports);
router.put('/supports/:id', auth, permission('skill_training.update'), validate(supportSchema), ctrl.updateSupport);

router.get('/sgk', auth, permission('skill_training.read'), ctrl.listSgk);
router.post('/sgk/prepare', auth, permission('skill_training.create'), validate(prepareSgkSchema), ctrl.prepareSgk);
router.put('/sgk/:id', auth, permission('skill_training.update'), validate(sgkSchema), ctrl.updateSgk);

router.get('/documents', auth, permission('skill_training.read'), ctrl.download);

module.exports = router;
