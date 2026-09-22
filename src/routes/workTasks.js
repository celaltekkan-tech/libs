const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/workTasksController');
const validate = require('../middlewares/validate');
const { createWorkTaskSchema, updateWorkTaskSchema } = require('../validators/workTask.validator');
const auth = require('../middlewares/auth');
const permission = require('../middlewares/permission');

router.get('/', auth, permission('work_tasks.read'), ctrl.list);
router.get('/:id', auth, permission('work_tasks.read'), ctrl.get);
router.post('/', auth, permission('work_tasks.create'), validate(createWorkTaskSchema), ctrl.create);
router.put('/:id', auth, permission('work_tasks.update'), validate(updateWorkTaskSchema), ctrl.update);
router.post('/:id/complete', auth, permission('work_tasks.read'), ctrl.complete);
router.post('/:id/pause', auth, permission('work_tasks.update'), ctrl.pause);
router.post('/:id/resume', auth, permission('work_tasks.update'), ctrl.resume);
router.delete('/:id', auth, permission('work_tasks.delete'), ctrl.remove);

module.exports = router;
