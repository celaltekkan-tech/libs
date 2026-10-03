const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/platformMobileRegisterController');
const validate = require('../middlewares/validate');
const { mobileRegisterVisibilitySchema } = require('../validators/user.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.list);
router.post(
  '/:id/visibility',
  auth,
  platformAdmin,
  validate(mobileRegisterVisibilitySchema),
  ctrl.setVisibility,
);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
