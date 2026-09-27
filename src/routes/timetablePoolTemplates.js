'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/timetablePoolTemplateController');
const validate = require('../middlewares/validate');
const { importTemplateSchema } = require('../validators/lessonPoolTemplate.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

// Otomatik ders programı modülü içinde hazır (MEB) ders havuzları.
const guard = [auth, requireModule('schedule')];

router.get('/pool-templates', ...guard, permission('schedule.read'), ctrl.list);
router.post(
  '/projects/:projectId/pool/import-template',
  ...guard,
  permission('schedule.update'),
  validate(importTemplateSchema),
  ctrl.importToPool
);

module.exports = router;
