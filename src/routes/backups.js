const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/backupsController');
const backupService = require('../services/backupService');
const validate = require('../middlewares/validate');
const { updateBackupSettingsSchema } = require('../validators/backupSetting.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

const importUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: backupService.IMPORT_MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    const name = path.basename(file.originalname || '').toLowerCase();
    if (!name.endsWith('.sql.gz')) {
      const err = new Error('Yalnızca .sql.gz yedek dosyaları kabul edilir');
      err.status = 400;
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

function handleImportError(err, req, res, next) {
  if (!err) return next();
  if (req.file?.path) {
    fs.unlink(req.file.path, () => {});
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    const mb = Math.max(1, Math.round(backupService.IMPORT_MAX_BYTES / (1024 * 1024)));
    return res.status(400).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: `Yedek dosyası en fazla ${mb} MB olabilir`,
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

router.get('/settings', auth, platformAdmin, ctrl.getSettings);
router.put('/settings', auth, platformAdmin, validate(updateBackupSettingsSchema), ctrl.updateSettings);
router.get('/', auth, platformAdmin, ctrl.list);
router.get('/logs', auth, platformAdmin, ctrl.logs);
router.post('/run', auth, platformAdmin, ctrl.run);
router.post(
  '/import',
  auth,
  platformAdmin,
  (req, res, next) => {
    importUpload.single('file')(req, res, (err) => handleImportError(err, req, res, next));
  },
  ctrl.importFile,
);
router.get('/:filename/download', auth, platformAdmin, ctrl.download);
router.post('/:filename/restore', auth, platformAdmin, ctrl.restore);
router.delete('/:filename', auth, platformAdmin, ctrl.remove);

module.exports = router;
