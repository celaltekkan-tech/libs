const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/disciplineIncidentsController');
const validate = require('../middlewares/validate');
const {
  createIncidentSchema,
  updateIncidentSchema,
  addParticipantSchema,
  updateParticipantSchema,
  excelCommitSchema,
} = require('../validators/disciplineIncident.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.list);
router.get('/stats', auth, moduleGuard, permission('discipline.read'), ctrl.stats);
router.get('/sanctioned-students', auth, moduleGuard, permission('discipline.read'), ctrl.sanctionedStudents);
router.post('/', auth, moduleGuard, permission('discipline.create'), validate(createIncidentSchema), ctrl.create);

router.get('/:id', auth, moduleGuard, permission('discipline.read'), ctrl.get);
router.patch('/:id', auth, moduleGuard, permission('discipline.update'), validate(updateIncidentSchema), ctrl.update);
router.delete('/:id', auth, moduleGuard, permission('discipline.delete'), ctrl.remove);
router.get('/:id/document', auth, moduleGuard, permission('discipline.read'), ctrl.document);

router.post(
  '/:id/participants',
  auth,
  moduleGuard,
  permission('discipline.update'),
  validate(addParticipantSchema),
  ctrl.addParticipant
);
router.patch(
  '/participants/:participantId',
  auth,
  moduleGuard,
  permission('discipline.update'),
  validate(updateParticipantSchema),
  ctrl.updateParticipant
);
router.delete('/participants/:participantId', auth, moduleGuard, permission('discipline.update'), ctrl.removeParticipant);

router.post(
  '/:id/participants/excel-preview',
  auth,
  moduleGuard,
  permission('discipline.update'),
  upload.single('file'),
  ctrl.excelPreview
);
router.post(
  '/:id/participants/excel-commit',
  auth,
  moduleGuard,
  permission('discipline.update'),
  validate(excelCommitSchema),
  ctrl.excelCommit
);

module.exports = router;
