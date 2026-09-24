const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/presenceController');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.summary);

module.exports = router;
