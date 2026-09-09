const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditLogsController');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');
const requireModule = require('../middlewares/moduleGuard');

const moduleGuard = requireModule('audit');

// Denetim kayıtları planda audit modülü olan tenant'larda ve yalnızca Müdür (ve global admin) tarafından görülebilir.
router.get('/', auth, moduleGuard, permission.checkRole(['Müdür', 'admin', 'supervisor']), ctrl.list);

module.exports = router;
