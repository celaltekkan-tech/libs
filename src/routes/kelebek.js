const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/kelebekController');
const validate = require('../middlewares/validate');
const {
  createExamRoomSchema,
  updateExamRoomSchema,
  createExamSessionSchema,
  generateSeatingSchema,
  markAttendanceSchema,
  assignProctorSchema,
} = require('../validators/kelebek.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('exams');

router.get('/rooms', auth, moduleGuard, permission('exams.read'), ctrl.listRooms);
router.post('/rooms', auth, moduleGuard, permission('exams.create'), validate(createExamRoomSchema), ctrl.createRoom);
router.put('/rooms/:id', auth, moduleGuard, permission('exams.update'), validate(updateExamRoomSchema), ctrl.updateRoom);
router.delete('/rooms/:id', auth, moduleGuard, permission('exams.delete'), ctrl.removeRoom);

router.get('/sessions', auth, moduleGuard, permission('exams.read'), ctrl.listSessions);
router.post('/sessions', auth, moduleGuard, permission('exams.create'), validate(createExamSessionSchema), ctrl.createSession);
router.delete('/sessions/:id', auth, moduleGuard, permission('exams.delete'), ctrl.removeSession);

router.post(
  '/sessions/:id/generate-seating',
  auth,
  moduleGuard,
  permission('exams.create'),
  validate(generateSeatingSchema),
  ctrl.generateSeating,
);
router.get('/sessions/:id/seating', auth, moduleGuard, permission('exams.read'), ctrl.getSeating);
router.get('/sessions/:id/seating/export', auth, moduleGuard, permission('exams.read'), ctrl.exportSeating);
router.post(
  '/sessions/:id/attendance',
  auth,
  moduleGuard,
  permission('exams.update'),
  validate(markAttendanceSchema),
  ctrl.markAttendance,
);

router.get('/sessions/:id/proctors', auth, moduleGuard, permission('exams.read'), ctrl.listProctors);
router.post(
  '/sessions/:id/proctors',
  auth,
  moduleGuard,
  permission('exams.create'),
  validate(assignProctorSchema),
  ctrl.assignProctor,
);
router.delete('/sessions/:id/proctors/:proctorId', auth, moduleGuard, permission('exams.delete'), ctrl.removeProctor);

module.exports = router;
