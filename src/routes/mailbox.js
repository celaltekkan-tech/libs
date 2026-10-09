const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mailboxController');
const validate = require('../middlewares/validate');
const { sendMailboxSchema, seenMailboxSchema } = require('../validators/mailbox.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

router.get('/', auth, platformAdmin, ctrl.status);
router.get('/messages', auth, platformAdmin, ctrl.list);
router.post('/messages', auth, platformAdmin, validate(sendMailboxSchema), ctrl.send);
router.get('/messages/:uid', auth, platformAdmin, ctrl.get);
router.get('/messages/:uid/attachments/:index', auth, platformAdmin, ctrl.attachment);
router.patch('/messages/:uid', auth, platformAdmin, validate(seenMailboxSchema), ctrl.seen);
router.delete('/messages/:uid', auth, platformAdmin, ctrl.remove);

module.exports = router;
