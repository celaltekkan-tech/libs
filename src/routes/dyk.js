const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dykController');
const validate = require('../middlewares/validate');
const {
  createDykCourseSchema,
  updateDykCourseSchema,
  enrollStudentsSchema,
  markAttendanceSchema,
} = require('../validators/dyk.validator');
const auth = require('../middlewares/auth');
const requireModule = require('../middlewares/moduleGuard');
const permission = require('../middlewares/permission');

const moduleGuard = requireModule('attendance');

router.get('/courses', auth, moduleGuard, permission('attendance.read'), ctrl.listCourses);
router.post('/courses', auth, moduleGuard, permission('attendance.create'), validate(createDykCourseSchema), ctrl.createCourse);
router.put('/courses/:id', auth, moduleGuard, permission('attendance.update'), validate(updateDykCourseSchema), ctrl.updateCourse);
router.delete('/courses/:id', auth, moduleGuard, permission('attendance.delete'), ctrl.removeCourse);

router.get('/courses/:id/enrollments', auth, moduleGuard, permission('attendance.read'), ctrl.listEnrollments);
router.post('/courses/:id/enrollments', auth, moduleGuard, permission('attendance.create'), validate(enrollStudentsSchema), ctrl.enrollStudents);
router.delete('/courses/:id/enrollments/:studentId', auth, moduleGuard, permission('attendance.delete'), ctrl.unenrollStudent);

router.post('/courses/:id/attendance', auth, moduleGuard, permission('attendance.create'), validate(markAttendanceSchema), ctrl.markAttendance);
router.get('/courses/:id/attendance-summary', auth, moduleGuard, permission('attendance.read'), ctrl.attendanceSummary);

module.exports = router;
