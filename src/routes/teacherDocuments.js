const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teacherDocumentsController');
const validate = require('../middlewares/validate');
const {
  createDocumentSchema,
  updateDocumentSchema,
  reviewDocumentSchema,
  duplicateDocumentSchema,
} = require('../validators/teacherDocument.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('teachers');

router.get('/', auth, moduleGuard, permission('teacher_documents.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('teacher_documents.create'), validate(createDocumentSchema), ctrl.create);
router.put('/:id', auth, moduleGuard, permission('teacher_documents.update'), validate(updateDocumentSchema), ctrl.update);
router.post(
  '/:id/review',
  auth,
  moduleGuard,
  permission('teacher_documents.update'),
  validate(reviewDocumentSchema),
  ctrl.review,
);
router.post(
  '/:id/duplicate',
  auth,
  moduleGuard,
  permission('teacher_documents.create'),
  validate(duplicateDocumentSchema),
  ctrl.duplicate,
);
router.delete('/:id', auth, moduleGuard, permission('teacher_documents.delete'), ctrl.remove);

module.exports = router;
