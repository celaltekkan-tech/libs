const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/announcementsController');
const validate = require('../middlewares/validate');
const { createAnnouncementSchema } = require('../validators/announcement.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('communications');

router.get('/', auth, moduleGuard, permission('communications.read'), ctrl.list);
router.get('/preview-recipients', auth, moduleGuard, permission('communications.read'), ctrl.previewRecipients);
router.post('/', auth, moduleGuard, permission('communications.create'), validate(createAnnouncementSchema), ctrl.create);
router.post('/:id/mark-sent', auth, moduleGuard, permission('communications.update'), ctrl.markSent);
router.delete('/:id', auth, moduleGuard, permission('communications.delete'), ctrl.remove);

module.exports = router;
