const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/regulationsController');
const auth = require('../middlewares/auth');

router.get('/:slug/download', auth, ctrl.download);

module.exports = router;
