const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplineDecisionsController');
const validate = require('../middlewares/validate');
const { createDecisionSchema, updateDecisionSchema, createNotificationSchema } = require('../validators/disciplineDecision.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.listDecisions);
router.post('/', auth, moduleGuard, permission('discipline.update'), validate(createDecisionSchema), ctrl.createDecision);
router.patch('/:id', auth, moduleGuard, permission('discipline.update'), validate(updateDecisionSchema), ctrl.updateDecision);
router.delete('/:id', auth, moduleGuard, permission('discipline.delete'), ctrl.removeDecision);
router.get('/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.decisionDocument);

router.get('/notifications/list', auth, moduleGuard, permission('discipline.read'), ctrl.listNotifications);
router.post('/notifications', auth, moduleGuard, permission('discipline.update'), validate(createNotificationSchema), ctrl.createNotification);
router.patch('/notifications/:id', auth, moduleGuard, permission('discipline.update'), ctrl.updateNotification);
router.delete('/notifications/:id', auth, moduleGuard, permission('discipline.update'), ctrl.removeNotification);
router.get('/notifications/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.notificationDocument);

module.exports = router;
