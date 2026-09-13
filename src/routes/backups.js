const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/backupsController');
const validate = require('../middlewares/validate');
const { updateBackupSettingsSchema } = require('../validators/backupSetting.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

// Veritabanı yedekleri sunucu genelinde tek bir prosedürle (scripts/db-backup.sh)
// alınır; burada yalnızca saklama süresi ayarı ve mevcut yedeklerin listesi yönetilir.
router.get('/settings', auth, platformAdmin, ctrl.getSettings);
router.put('/settings', auth, platformAdmin, validate(updateBackupSettingsSchema), ctrl.updateSettings);
router.get('/', auth, platformAdmin, ctrl.list);
router.delete('/:filename', auth, platformAdmin, ctrl.remove);

module.exports = router;
