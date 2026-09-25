const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/smsTestController');
const validate = require('../middlewares/validate');
const { sendSmsTestSchema } = require('../validators/smsTest.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.get);
router.post('/', auth, platformAdmin, validate(sendSmsTestSchema), ctrl.send);

module.exports = router;
