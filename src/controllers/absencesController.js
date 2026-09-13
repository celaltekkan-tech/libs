'use strict';

const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const { StudentAbsence, Student, Classroom, School, Holiday } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const THRESHOLDS = [10, 20, 30];

// Devamsızlık eşiği hesaplamasında mazeretsiz gün 1, yarım gün 0.5 olarak
// sayılır; mazeretli ve raporlu günler toplam devamsızlığa dahil edilmez.
const ABSENCE_TYPE_WEIGHTS = { mazeretsiz: 1, yarim_gun: 0.5, mazeretli: 0, raporlu: 0 };
const ABSENCE_TYPE_LABELS = {
  mazeretsiz: 'Mazeretsiz',
  mazeretli: 'Mazeretli',
  raporlu: 'Raporlu',
  yarim_gun: 'Yarım Gün',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

function weightOf(absenceType) {
  return ABSENCE_TYPE_WEIGHTS[absenceType] ?? 1;
}

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number', 'parent_name', 'parent_phone'],
  include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
  required: false,
};

module.exports = {
  ABSENCE_TYPE_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);
      if (req.query.start_date && req.query.end_date) {
        where.absence_date = { [Op.gte]: req.query.start_date, [Op.lte]: req.query.end_date };
      }

      const rows = await StudentAbsence.findAll({
        where,
        include: [studentInclude],
        order: [['absence_date', 'DESC']],
        limit: 5000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async bulkCreate(req, res, next) {
    try {
      const { absence_date, entries } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      let created = 0;
      let updated = 0;
      for (const entry of entries) {
        const [row, wasCreated] = await StudentAbsence.findOrCreate({
          where: { tenant_id: tenantId, student_id: entry.student_id, absence_date },
          defaults: {
            tenant_id: tenantId,
            student_id: entry.student_id,
            absence_date,
            absence_type: entry.absence_type,
            reason: entry.reason ?? null,
          },
        });
        if (!wasCreated) {
          await row.update({ absence_type: entry.absence_type, reason: entry.reason ?? row.reason });
          updated += 1;
        } else {
          created += 1;
        }
      }

      await audit.log(req, {
        action: 'create',
        entityType: 'student_absence_batch',
        summary: `Devamsızlık girişi: ${absence_date} (${entries.length} öğrenci, ${created} yeni, ${updated} güncellendi)`,
      });

      res.json({ success: true, data: { processed: entries.length, created, updated } });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await StudentAbsence.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // Devamsızlık eşiklerine (10/20/30 gün) ulaşan öğrenciler için uyarı listesi.
  async warnings(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = { tenant_id: tenantId };
      if (req.query.start_date && req.query.end_date) {
        where.absence_date = { [Op.gte]: req.query.start_date, [Op.lte]: req.query.end_date };
      }

      const rows = await StudentAbsence.findAll({ where, include: [studentInclude] });
      const byStudent = new Map();
      rows.forEach((row) => {
        if (!row.Student) return;
        const weight = weightOf(row.absence_type);
        if (weight <= 0) return;
        const key = row.student_id;
        if (!byStudent.has(key)) {
          byStudent.set(key, {
            student_id: key,
            student_name: `${row.Student.first_name} ${row.Student.last_name}`,
            student_number: row.Student.student_number,
            classroom: row.Student.Classroom ? `${row.Student.Classroom.class_level}/${row.Student.Classroom.section}` : null,
            count: 0,
          });
        }
        byStudent.get(key).count += weight;
      });

      const data = Array.from(byStudent.values())
        .map((row) => ({
          ...row,
          threshold_crossed: THRESHOLDS.filter((t) => row.count >= t).pop() || null,
        }))
        .filter((row) => row.threshold_crossed)
        .sort((a, b) => b.count - a.count);

      res.json({ success: true, data, thresholds: THRESHOLDS });
    } catch (err) {
      next(err);
    }
  },

  // Devamsızlık ihtar yazısı (PDF).
  async warningLetter(req, res, next) {
    try {
      const student = await Student.findByPk(req.params.studentId, {
        include: [
          { model: Classroom, required: false },
          { model: School, required: false },
        ],
      });
      if (!student) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, student)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const tenantId = req.user && req.user.tenant_id;
      const rows = await StudentAbsence.findAll({ where: { tenant_id: tenantId, student_id: student.id } });
      const count = rows.reduce((sum, r) => sum + weightOf(r.absence_type), 0);

      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="devamsizlik-ihtar-${student.student_number || student.id}.pdf"`);
      doc.pipe(res);

      const schoolName = student.School?.name || 'Okul Müdürlüğü';
      doc.fontSize(13).text(schoolName.toUpperCase(), { align: 'center' });
      doc.fontSize(13).text('DEVAMSIZLIK İHTAR YAZISI', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(11);
      doc.font('Helvetica-Bold').text('Öğrenci: ', { continued: true });
      doc.font('Helvetica').text(`${student.first_name} ${student.last_name}`);
      doc.font('Helvetica-Bold').text('Öğrenci No: ', { continued: true });
      doc.font('Helvetica').text(student.student_number || '—');
      doc.font('Helvetica-Bold').text('Sınıf / Şube: ', { continued: true });
      doc.font('Helvetica').text(student.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : '—');
      doc.font('Helvetica-Bold').text('Toplam Devamsızlık: ', { continued: true });
      doc.font('Helvetica').text(`${count} gün`);
      doc.moveDown(2);

      doc.text(
        `Yukarıda kimlik bilgileri yazılı öğrencinin okulumuz kayıtlarına göre devamsızlık süresi ${count} güne ulaşmıştır. Mevzuat gereği velinizin bilgilendirilmesi amacıyla işbu yazı düzenlenmiştir.`,
        { align: 'justify' }
      );

      doc.moveDown(4);
      doc.text(`Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
      doc.moveDown(2);
      doc.text('Okul Müdürü', { align: 'right' });

      await audit.log(req, {
        action: 'export',
        entityType: 'absence_warning_letter',
        entityId: student.id,
        summary: `Devamsızlık ihtar yazısı üretildi: ${student.first_name} ${student.last_name} (${count} gün)`,
      });

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  // Ay bazlı takvim görünümü. student_id verilirse yalnızca o öğrencinin
  // devamsızlık günleri döner; verilmezse tüm öğrenciler için gün bazlı
  // devamsız oranı (renk yoğunluğu için) ve o gün devamsız olan öğrenci listesi döner.
  async calendar(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month) {
        return res.status(400).json({ success: false, message: 'year ve month zorunludur' });
      }
      const studentId = req.query.student_id ? Number(req.query.student_id) : null;

      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const totalStudents = await Student.count({ where: { tenant_id: tenantId } });

      const holidays = await Holiday.findAll({ where: { tenant_id: tenantId, month } });
      const holidayByDay = new Map();
      holidays.forEach((h) => {
        if (h.year == null || h.year === year) holidayByDay.set(h.day, h.name);
      });

      const where = { tenant_id: tenantId, absence_date: { [Op.between]: [monthStart, monthEnd] } };
      if (studentId) where.student_id = studentId;
      const rows = await StudentAbsence.findAll({ where, include: [studentInclude] });

      const days = [];
      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayRows = rows.filter((r) => r.absence_date === dateStr);
        days.push({
          date: dateStr,
          day,
          is_holiday: holidayByDay.has(day),
          holiday_name: holidayByDay.get(day) || null,
          absent_count: dayRows.length,
          total_students: totalStudents,
          absent_ratio: totalStudents > 0 ? dayRows.length / totalStudents : 0,
          students: dayRows.map((r) => ({
            student_id: r.student_id,
            student_name: r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : null,
            student_number: r.Student?.student_number || null,
            absence_type: r.absence_type,
            reason: r.reason,
          })),
        });
      }

      res.json({ success: true, data: { total_students: totalStudents, student_id: studentId, days } });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, start_date, end_date } = req.validatedBody || req.body || {};
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (start_date && end_date) where.absence_date = { [Op.gte]: start_date, [Op.lte]: end_date };

      const rows = await StudentAbsence.findAll({
        where,
        include: [studentInclude],
        order: [['absence_date', 'DESC']],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'devamsizlik-raporu',
        title: 'Devamsızlık Raporu',
        headers: ['Öğrenci', 'Öğrenci No', 'Sınıf', 'Tarih', 'Durum', 'Açıklama'],
        rows: rows.map((r) => [
          r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '',
          r.Student?.student_number || '',
          r.Student?.Classroom ? `${r.Student.Classroom.class_level}/${r.Student.Classroom.section}` : '',
          r.absence_date,
          ABSENCE_TYPE_LABELS[r.absence_type] || r.absence_type,
          r.reason || '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
