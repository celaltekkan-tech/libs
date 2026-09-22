const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplineFormsController');
const validate = require('../middlewares/validate');
const {
  createStatementSchema,
  updateStatementSchema,
  createInfoRequestSchema,
  updateInfoRequestSchema,
  createMeetingNoticeSchema,
  updateMeetingNoticeSchema,
} = require('../validators/disciplineForms.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

// İfade / sözlü ifade / savunma tutanakları
router.get('/statements', auth, moduleGuard, permission('discipline.read'), ctrl.listStatements);
router.post('/statements', auth, moduleGuard, permission('discipline.update'), validate(createStatementSchema), ctrl.createStatement);
router.patch('/statements/:id', auth, moduleGuard, permission('discipline.update'), validate(updateStatementSchema), ctrl.updateStatement);
router.delete('/statements/:id', auth, moduleGuard, permission('discipline.update'), ctrl.removeStatement);
router.get('/statements/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.statementDocument);

// Bilgi toplama formları
router.get('/info-requests', auth, moduleGuard, permission('discipline.read'), ctrl.listInfoRequests);
router.post('/info-requests', auth, moduleGuard, permission('discipline.update'), validate(createInfoRequestSchema), ctrl.createInfoRequest);
router.patch('/info-requests/:id', auth, moduleGuard, permission('discipline.update'), validate(updateInfoRequestSchema), ctrl.updateInfoRequest);
router.delete('/info-requests/:id', auth, moduleGuard, permission('discipline.update'), ctrl.removeInfoRequest);
router.get('/info-requests/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.infoRequestDocument);

// Çağrı pusulaları / toplantı çağrıları
router.get('/meeting-notices', auth, moduleGuard, permission('discipline.read'), ctrl.listMeetingNotices);
router.post('/meeting-notices', auth, moduleGuard, permission('discipline.update'), validate(createMeetingNoticeSchema), ctrl.createMeetingNotice);
router.patch('/meeting-notices/:id', auth, moduleGuard, permission('discipline.update'), validate(updateMeetingNoticeSchema), ctrl.updateMeetingNotice);
router.delete('/meeting-notices/:id', auth, moduleGuard, permission('discipline.update'), ctrl.removeMeetingNotice);
router.get('/meeting-notices/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.meetingNoticeDocument);

module.exports = router;
