'use strict';

const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/lessonPoolTemplatesController');
const validate = require('../middlewares/validate');
const { createTemplateSchema, updateTemplateSchema } = require('../validators/lessonPoolTemplate.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.pdf', '.xls', '.xlsx'].includes(ext)) {
      const err = new Error('Yalnızca PDF, XLS veya XLSX dosyası yüklenebilir');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
    console.warn('[lesson-pools] yükleme reddedildi:', err.code || '', err.message);
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya 15 MB sınırını aşıyor' : err.message;
    return res.status(status).json({ success: false, message });
  });
}

router.post('/parse', auth, platformAdmin, uploadSingle, ctrl.parse);
router.get('/', auth, platformAdmin, ctrl.list);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.post('/', auth, platformAdmin, validate(createTemplateSchema), ctrl.create);
router.put('/:id', auth, platformAdmin, validate(updateTemplateSchema), ctrl.update);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
