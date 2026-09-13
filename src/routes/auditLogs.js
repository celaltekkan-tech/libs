const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditLogsController');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');
const requireModule = require('../middlewares/moduleGuard');

const moduleGuard = requireModule('audit');

// Denetim kayıtları: audit modülü + audit.read izni
router.get('/', auth, moduleGuard, permission('audit.read'), ctrl.list);

module.exports = router;
