const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feedbackController');
const validate = require('../middlewares/validate');
const {
  createFeedbackSchema,
  updateFeedbackSchema,
  cancelFeedbackSchema,
  addFeedbackUpdateSchema,
} = require('../validators/feedback.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');
const ticketKind = require('../middlewares/ticketKind');
const { upload } = require('../services/feedbackUpload');

const kind = ticketKind('support');

function handleMulterError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: 'Dosya boyutu en fazla 5 MB olabilir',
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      code: 'TOO_MANY_FILES',
      message: 'En fazla 5 dosya yüklenebilir',
    });
  }
  if (err.status === 400 || err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      code: err.code || 'INVALID_FILE_TYPE',
      message: err.message,
    });
  }
  return next(err);
}

router.post(
  '/',
  auth,
  kind,
  (req, res, next) => {
    upload.array('files', 5)(req, res, (err) => handleMulterError(err, req, res, next));
  },
  validate(createFeedbackSchema),
  ctrl.create
);

router.get('/mine', auth, kind, ctrl.listMine);
router.put('/:id/cancel', auth, kind, validate(cancelFeedbackSchema), ctrl.cancelMine);
router.post('/:id/updates', auth, kind, validate(addFeedbackUpdateSchema), ctrl.addUpdate);
router.get('/attachments/:attachmentId/download', auth, kind, ctrl.downloadAttachment);

router.get('/', auth, platformAdmin, kind, ctrl.list);
router.get('/:id', auth, platformAdmin, kind, ctrl.get);
router.put('/:id', auth, platformAdmin, kind, validate(updateFeedbackSchema), ctrl.update);
router.delete('/:id', auth, platformAdmin, kind, ctrl.remove);

module.exports = router;
