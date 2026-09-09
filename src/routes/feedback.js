const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feedbackController');
const validate = require('../middlewares/validate');
const { createFeedbackSchema, updateFeedbackSchema } = require('../validators/feedback.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');
const { upload } = require('../services/feedbackUpload');

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

// Giriş yapmış her kullanıcı kendi hesabı adına geri bildirim gönderebilir (opsiyonel dosya)
router.post(
  '/',
  auth,
  (req, res, next) => {
    upload.array('files', 5)(req, res, (err) => handleMulterError(err, req, res, next));
  },
  validate(createFeedbackSchema),
  ctrl.create
);

router.get('/mine', auth, ctrl.listMine);

// Ek indirme: platform admin veya ilgili tenant kullanıcısı
router.get('/attachments/:attachmentId/download', auth, ctrl.downloadAttachment);

router.get('/', auth, platformAdmin, ctrl.list);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.put('/:id', auth, platformAdmin, validate(updateFeedbackSchema), ctrl.update);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
