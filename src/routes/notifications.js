const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationsController');
const validate = require('../middlewares/validate');
const { createNotificationSchema } = require('../validators/notification.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/mine', auth, ctrl.listMine);
router.get('/unread-count', auth, ctrl.unreadCount);
router.get('/sent', auth, platformAdmin, ctrl.listSent);
router.get('/recipient-options', auth, platformAdmin, ctrl.recipientOptions);
router.put('/read-all', auth, ctrl.markAllRead);
router.put('/:id/read', auth, ctrl.markRead);
router.post('/', auth, platformAdmin, validate(createNotificationSchema), ctrl.create);

module.exports = router;
