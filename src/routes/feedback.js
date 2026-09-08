const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feedbackController');
const validate = require('../middlewares/validate');
const { createFeedbackSchema, updateFeedbackSchema } = require('../validators/feedback.validator');
const auth = require('../middlewares/auth');
const platformAdmin = require('../middlewares/platformAdmin');

// Giriş yapmış her kullanıcı kendi hesabı adına geri bildirim gönderebilir
router.post('/', auth, validate(createFeedbackSchema), ctrl.create);

// Geri bildirimleri sadece platform yöneticisi görüntüleyip yönetebilir
router.get('/', auth, platformAdmin, ctrl.list);
router.get('/:id', auth, platformAdmin, ctrl.get);
router.put('/:id', auth, platformAdmin, validate(updateFeedbackSchema), ctrl.update);
router.delete('/:id', auth, platformAdmin, ctrl.remove);

module.exports = router;
