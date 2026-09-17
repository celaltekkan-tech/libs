const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/messageLogsController');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

router.get('/', auth, permission('message_logs.read'), ctrl.list);
router.post('/:id/hide', auth, permission('message_logs.read'), ctrl.hide);
router.delete('/:id/hide', auth, permission('message_logs.read'), ctrl.unhide);

module.exports = router;
