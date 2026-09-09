'use strict';

const {
  ExamRoom,
  ExamSession,
  SeatAssignment,
  ProctorAssignment,
  Student,
  Classroom,
  Teacher,
} = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

module.exports = {
  // --- Salonlar ---
  async listRooms(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const rows = await ExamRoom.findAll({ where: { tenant_id: tenantId }, order: [['name', 'ASC']] });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createRoom(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const row = await ExamRoom.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async updateRoom(req, res, next) {
    try {
      const row = await ExamRoom.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async removeRoom(req, res, next) {
    try {
      const row = await ExamRoom.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // --- Sınav oturumları (kelebek uygulanacak sınav günü) ---
  async listSessions(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const rows = await ExamSession.findAll({ where: { tenant_id: tenantId }, order: [['exam_date', 'DESC']] });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createSession(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const row = await ExamSession.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'exam_session',
        entityId: row.id,
        summary: `Kelebek sınav oturumu oluşturuldu: ${row.name}`,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async removeSession(req, res, next) {
    try {
      const row = await ExamSession.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // Kelebek oturma düzeni: seçilen sınıflardan gelen öğrenciler sırayla
  // iç içe geçirilir (round-robin) ki ardışık sıralarda aynı sınıftan
  // öğrenci bulunmasın (kopya riski azaltma); ardından salon kapasitesine
  // göre sıra numarası verilerek dağıtılır.
  async generateSeating(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { exam_room_ids, classroom_ids } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      const rooms = await ExamRoom.findAll({ where: { id: exam_room_ids, tenant_id: tenantId } });
      if (rooms.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli salon bulunamadı' });
      }

      const classrooms = await Classroom.findAll({ where: { id: classroom_ids, tenant_id: tenantId } });
      const byClassroom = [];
      for (const classroom of classrooms) {
        const students = await Student.findAll({
          where: { classroom_id: classroom.id, tenant_id: tenantId },
          order: [['last_name', 'ASC'], ['first_name', 'ASC']],
        });
        byClassroom.push({
          label: `${classroom.class_level}/${classroom.section}`,
          students: students.map((s) => ({ id: s.id, label: `${classroom.class_level}/${classroom.section}` })),
        });
      }

      // Round-robin ile sınıfları iç içe geçir.
      const interleaved = [];
      let remaining = true;
      let idx = 0;
      while (remaining) {
        remaining = false;
        for (const group of byClassroom) {
          if (group.students[idx]) {
            interleaved.push(group.students[idx]);
            remaining = true;
          }
        }
        idx += 1;
      }

      if (interleaved.length === 0) {
        return res.status(400).json({ success: false, message: 'Seçilen sınıflarda öğrenci bulunamadı' });
      }

      const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
      if (interleaved.length > totalCapacity) {
        return res.status(400).json({
          success: false,
          message: `Toplam öğrenci sayısı (${interleaved.length}) salon kapasitesini (${totalCapacity}) aşıyor`,
        });
      }

      // Önceki atamaları temizle (yeniden oluşturma senaryosu).
      await SeatAssignment.destroy({ where: { exam_session_id: session.id } });

      let cursor = 0;
      const created = [];
      for (const room of rooms) {
        for (let seat = 1; seat <= room.capacity && cursor < interleaved.length; seat += 1) {
          const student = interleaved[cursor];
          created.push({
            tenant_id: tenantId,
            exam_session_id: session.id,
            exam_room_id: room.id,
            student_id: student.id,
            seat_no: seat,
            classroom_label: student.label,
          });
          cursor += 1;
        }
      }

      await SeatAssignment.bulkCreate(created);

      await audit.log(req, {
        action: 'create',
        entityType: 'seat_assignment_batch',
        entityId: session.id,
        summary: `Kelebek oturma düzeni oluşturuldu: ${session.name} (${created.length} öğrenci)`,
      });

      res.json({ success: true, data: { assigned: created.length } });
    } catch (err) {
      next(err);
    }
  },

  async getSeating(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const rows = await SeatAssignment.findAll({
        where: { exam_session_id: session.id },
        include: [
          { model: ExamRoom, attributes: ['id', 'name'] },
          { model: Student, attributes: ['id', 'first_name', 'last_name', 'student_number'] },
        ],
        order: [
          ['exam_room_id', 'ASC'],
          ['seat_no', 'ASC'],
        ],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async markAttendance(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { entries } = req.validatedBody || req.body;
      for (const entry of entries) {
        const seat = await SeatAssignment.findOne({
          where: { id: entry.seat_assignment_id, exam_session_id: session.id },
        });
        if (seat) await seat.update({ present: entry.present });
      }
      res.json({ success: true, data: { processed: entries.length } });
    } catch (err) {
      next(err);
    }
  },

  async assignProctor(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { exam_room_id, teacher_id } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      const [row] = await ProctorAssignment.findOrCreate({
        where: { exam_room_id, teacher_id },
        defaults: { tenant_id: tenantId, exam_session_id: session.id, exam_room_id, teacher_id },
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, message: 'Bu öğretmen bu salona zaten atanmış' });
      }
      next(err);
    }
  },

  async listProctors(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const rows = await ProctorAssignment.findAll({
        where: { exam_session_id: session.id },
        include: [
          { model: ExamRoom, attributes: ['id', 'name'] },
          { model: Teacher, attributes: ['id', 'first_name', 'last_name'] },
        ],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async removeProctor(req, res, next) {
    try {
      const row = await ProctorAssignment.findByPk(req.params.proctorId);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async exportSeating(req, res, next) {
    try {
      const session = await ExamSession.findByPk(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, session)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const rows = await SeatAssignment.findAll({
        where: { exam_session_id: session.id },
        include: [
          { model: ExamRoom, attributes: ['id', 'name'] },
          { model: Student, attributes: ['id', 'first_name', 'last_name', 'student_number'] },
        ],
        order: [
          ['exam_room_id', 'ASC'],
          ['seat_no', 'ASC'],
        ],
      });

      const allowedFormats = ['xlsx', 'csv', 'pdf'];
      const format = allowedFormats.includes(req.query.format) ? req.query.format : 'xlsx';

      await sendTableExport(res, {
        format,
        filename: 'kelebek-oturma-plani',
        title: `Kelebek Oturma Planı — ${session.name}`,
        headers: ['Salon', 'Sıra No', 'Öğrenci', 'Öğrenci No', 'Sınıf'],
        rows: rows.map((r) => [
          r.ExamRoom?.name || '',
          r.seat_no,
          r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '',
          r.Student?.student_number || '',
          r.classroom_label || '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
