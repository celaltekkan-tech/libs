'use strict';

const { DykCourse, DykEnrollment, DykAttendanceRecord, Student, Subject, Teacher } = require('../models');
const audit = require('../services/auditService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const courseIncludes = [
  { model: Subject, attributes: ['id', 'name'], required: false },
  { model: Teacher, attributes: ['id', 'first_name', 'last_name'], required: false },
];

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number'],
  required: false,
};

module.exports = {
  async listCourses(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.is_active === 'true') where.is_active = true;

      const rows = await DykCourse.findAll({ where, include: courseIncludes, order: [['name', 'ASC']], limit: 500 });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createCourse(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const row = await DykCourse.create(payload);
      const full = await DykCourse.findByPk(row.id, { include: courseIncludes });
      await audit.log(req, {
        action: 'create',
        entityType: 'dyk_course',
        entityId: row.id,
        summary: `DYK kursu oluşturuldu: ${row.name}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateCourse(req, res, next) {
    try {
      const row = await DykCourse.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = { ...(req.validatedBody || req.body) };
      await row.update(payload);
      const full = await DykCourse.findByPk(row.id, { include: courseIncludes });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeCourse(req, res, next) {
    try {
      const row = await DykCourse.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const label = row.name;
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'dyk_course',
        entityId: id,
        summary: `DYK kursu silindi: ${label}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async enrollStudents(req, res, next) {
    try {
      const course = await DykCourse.findByPk(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, course)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { student_ids } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      let created = 0;
      for (const studentId of student_ids) {
        const [, wasCreated] = await DykEnrollment.findOrCreate({
          where: { dyk_course_id: course.id, student_id: studentId },
          defaults: { tenant_id: tenantId, dyk_course_id: course.id, student_id: studentId },
        });
        if (wasCreated) created += 1;
      }

      res.json({ success: true, data: { processed: student_ids.length, created } });
    } catch (err) {
      next(err);
    }
  },

  async unenrollStudent(req, res, next) {
    try {
      const row = await DykEnrollment.findOne({
        where: { dyk_course_id: req.params.id, student_id: req.params.studentId },
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async listEnrollments(req, res, next) {
    try {
      const course = await DykCourse.findByPk(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, course)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const rows = await DykEnrollment.findAll({
        where: { dyk_course_id: course.id },
        include: [studentInclude],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async markAttendance(req, res, next) {
    try {
      const course = await DykCourse.findByPk(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, course)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { session_date, entries } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      for (const entry of entries) {
        const [row] = await DykAttendanceRecord.findOrCreate({
          where: { dyk_course_id: course.id, student_id: entry.student_id, session_date },
          defaults: {
            tenant_id: tenantId,
            dyk_course_id: course.id,
            student_id: entry.student_id,
            session_date,
            present: entry.present,
          },
        });
        await row.update({ present: entry.present });
      }

      res.json({ success: true, data: { processed: entries.length } });
    } catch (err) {
      next(err);
    }
  },

  // Devam oranı; kursun min_attendance_rate eşiğinin altına düşen (kapatılması
  // gereken kurs adayı) öğrencileri de işaretler.
  async attendanceSummary(req, res, next) {
    try {
      const course = await DykCourse.findByPk(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, course)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const enrollments = await DykEnrollment.findAll({
        where: { dyk_course_id: course.id },
        include: [studentInclude],
      });
      const records = await DykAttendanceRecord.findAll({ where: { dyk_course_id: course.id } });

      const data = enrollments.map((enr) => {
        const studentRecords = records.filter((r) => r.student_id === enr.student_id);
        const total = studentRecords.length;
        const attended = studentRecords.filter((r) => r.present).length;
        const rate = total > 0 ? Math.round((attended / total) * 100) : null;
        return {
          student_id: enr.student_id,
          student_name: enr.Student ? `${enr.Student.first_name} ${enr.Student.last_name}` : null,
          student_number: enr.Student?.student_number || null,
          total_sessions: total,
          attended_sessions: attended,
          attendance_rate: rate,
          below_threshold: rate != null && rate < course.min_attendance_rate,
        };
      });

      res.json({ success: true, data, min_attendance_rate: course.min_attendance_rate });
    } catch (err) {
      next(err);
    }
  },
};
