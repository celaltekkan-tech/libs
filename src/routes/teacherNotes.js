const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teacherNotesController');
const validate = require('../middlewares/validate');
const { createTeacherNoteSchema } = require('../validators/teacherNote.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('discipline');

router.get('/tag-options', auth, moduleGuard, ctrl.tagOptions);
router.get('/mine', auth, moduleGuard, permission('teacher_notes.create'), ctrl.mine);
router.get('/', auth, moduleGuard, permission('discipline.read'), ctrl.list);
router.post('/', auth, moduleGuard, permission('teacher_notes.create'), validate(createTeacherNoteSchema), ctrl.create);
router.delete('/:id', auth, moduleGuard, permission('discipline.delete'), ctrl.remove);

module.exports = router;
