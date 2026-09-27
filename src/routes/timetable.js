const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/timetableController');
const pool = require('../controllers/timetablePoolController');
const validate = require('../middlewares/validate');
const v = require('../validators/timetable.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

// Otomatik ders programı; ders programı modülü ve yetkilerini kullanır.
const guard = [auth, requireModule('schedule')];
const read = [...guard, permission('schedule.read')];
const create = [...guard, permission('schedule.create')];
const update = [...guard, permission('schedule.update')];
const remove = [...guard, permission('schedule.delete')];

router.get('/meta', read, ctrl.meta);

router.get('/projects', read, ctrl.listProjects);
router.post('/projects', create, validate(v.createProjectSchema), ctrl.createProject);
router.get('/projects/:id', read, ctrl.getProject);
router.put('/projects/:id', update, validate(v.updateProjectSchema), ctrl.updateProject);
router.delete('/projects/:id', remove, ctrl.deleteProject);

router.get('/rooms', read, ctrl.listRooms);
router.post('/rooms', create, validate(v.createRoomSchema), ctrl.createRoom);
router.put('/rooms/:id', update, validate(v.updateRoomSchema), ctrl.updateRoom);
router.delete('/rooms/:id', remove, ctrl.deleteRoom);

router.get('/projects/:projectId/branches', read, pool.listBranches);
router.post('/projects/:projectId/branches', create, validate(v.createBranchSchema), pool.createBranch);
router.put('/projects/:projectId/branches/:id', update, validate(v.updateBranchSchema), pool.updateBranch);
router.delete('/projects/:projectId/branches/:id', remove, pool.deleteBranch);

router.get('/projects/:projectId/pool', read, pool.getPool);
router.put('/projects/:projectId/pool/subjects/:id', update, validate(v.poolSubjectSchema), pool.updatePoolSubject);
router.put('/projects/:projectId/pool/hours', update, validate(v.poolHourSchema), pool.upsertPoolHour);

router.get('/projects/:projectId/availability', read, pool.listAvailability);
router.put('/projects/:projectId/availability', update, validate(v.availabilitySchema), pool.saveAvailability);

router.get('/projects/:projectId/assignments', read, ctrl.listAssignments);
router.post('/projects/:projectId/assignments/copy', create, validate(v.copyAssignmentsSchema), ctrl.copyAssignments);
router.post('/projects/:projectId/assignments', create, validate(v.createAssignmentSchema), ctrl.createAssignment);
router.post('/projects/:projectId/assignments/generate', create, validate(v.generateAssignmentsSchema), ctrl.generateAssignments);
router.post('/projects/:projectId/assignments/bulk', update, validate(v.bulkAssignmentSchema), ctrl.bulkUpdateAssignments);
router.put('/assignments/:id', update, validate(v.updateAssignmentSchema), ctrl.updateAssignment);
router.delete('/assignments/:id', remove, ctrl.deleteAssignment);

router.get('/projects/:projectId/electives', read, ctrl.getElectives);
router.put('/projects/:projectId/electives', update, validate(v.electiveChoicesSchema), ctrl.saveElectives);

router.get('/projects/:projectId/constraints', read, ctrl.listConstraints);
router.post('/projects/:projectId/constraints', create, validate(v.createConstraintsSchema), ctrl.createConstraints);
router.post('/projects/:projectId/ai/parse', create, validate(v.aiParseSchema), ctrl.aiParse);
router.put('/constraints/:id', update, validate(v.updateConstraintSchema), ctrl.updateConstraint);
router.delete('/constraints/:id', remove, ctrl.deleteConstraint);

router.post('/projects/:projectId/check', read, ctrl.check);
router.post('/projects/:projectId/runs', create, validate(v.startRunSchema), ctrl.startRun);
router.get('/projects/:projectId/runs', read, ctrl.listRuns);
router.get('/runs/:id', read, ctrl.getRun);
router.post('/runs/:id/cancel', update, ctrl.cancelRun);
router.post('/runs/:id/apply', update, ctrl.applyRun);

router.get('/projects/:projectId/lessons', read, ctrl.listLessons);
router.post('/projects/:projectId/lessons/lock', update, validate(v.lockAllSchema), ctrl.lockAll);
router.delete('/projects/:projectId/lessons', remove, ctrl.clearLessons);
router.put('/lessons/:id/move', update, validate(v.moveLessonSchema), ctrl.moveLesson);
router.put('/lessons/:id/lock', update, validate(v.lockLessonSchema), ctrl.setLessonLock);
router.post('/projects/:projectId/publish', update, ctrl.publish);

module.exports = router;
