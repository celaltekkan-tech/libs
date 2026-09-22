'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  ResponsibilityExamItem,
  Student,
  Classroom,
  Subject,
  Teacher,
  School,
  ScheduleEntry,
} = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');
const {
  parseSorumlulukWorkbook,
  attachMatches,
  applySubjectMatches,
  summarizePreview,
  unmatchedSubjectNames,
  itemDedupeKey,
  normalizeSubjectLabel,
  normalizeStudentNumber,
} = require('../services/sorumlulukExamImportService');
const { ensureSubjectsForBranches } = require('../services/subjectFromBranchService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const classroomInclude = {
  model: Classroom,
  attributes: ['id', 'class_level', 'section', 'academic_year'],
  required: false,
};

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number', 'class_level', 'section'],
  required: false,
};

const subjectInclude = {
  model: Subject,
  attributes: ['id', 'name', 'difficulty_level'],
  required: false,
};

const teacherInclude = {
  model: Teacher,
  as: 'Teacher',
  attributes: ['id', 'first_name', 'last_name', 'personnel_no'],
  required: false,
};

const itemIncludes = [classroomInclude, studentInclude, subjectInclude, teacherInclude];

function subjectGroupWhere(tenantId, subjectClassLevel, subjectName) {
  return {
    tenant_id: tenantId,
    subject_class_level: String(subjectClassLevel),
    subject_name: normalizeSubjectLabel(subjectName),
  };
}

async function resolveTeacherFromSchedule(tenantId, subjectId) {
  if (!subjectId) return null;
  const entry = await ScheduleEntry.findOne({
    where: {
      tenant_id: tenantId,
      subject_id: subjectId,
      teacher_id: { [Op.ne]: null },
    },
    order: [['id', 'ASC']],
  });
  return entry?.teacher_id || null;
}

function asDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
}

function overlapWarning(groupItems, allItems, examDate) {
  if (!examDate) return null;
  const target = asDateOnly(examDate);
  const groupStudents = new Set(groupItems.map((r) => r.student_number));
  const conflicting = [];
  for (const row of allItems) {
    const onDate = asDateOnly(row.exam_date) === target || asDateOnly(row.oral_exam_date) === target;
    if (!onDate) continue;
    if (!groupStudents.has(row.student_number)) continue;
    const sameSubject =
      row.subject_class_level === groupItems[0]?.subject_class_level &&
      row.subject_name === groupItems[0]?.subject_name;
    if (sameSubject) continue;
    conflicting.push(`${row.student_name} (${row.subject_class_level}. ${row.subject_name})`);
  }
  if (conflicting.length === 0) return null;
  const sample = conflicting.slice(0, 8).join(', ');
  const extra = conflicting.length > 8 ? ` ve ${conflicting.length - 8} öğrenci daha` : '';
  return `Bu tarihte başka sorumluluk sınavı olan öğrenciler var: ${sample}${extra}`;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.school_id) where.school_id = Number(req.query.school_id);

      const rows = await ResponsibilityExamItem.findAll({
        where,
        include: itemIncludes,
        order: [
          ['current_class_level', 'ASC'],
          ['current_section', 'ASC'],
          ['student_name', 'ASC'],
          ['subject_class_level', 'ASC'],
          ['subject_name', 'ASC'],
        ],
        limit: 10000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async previewImport(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Excel dosyası yüklenmedi' });
      }
      const tenantId = req.user && req.user.tenant_id;
      const parsed = parseSorumlulukWorkbook(req.file.buffer);
      if (parsed.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'Dosyada tanınabilir kayıt bulunamadı. MEBBİS «Öğrencilerin Sorumlu Olduğu Dersler» dökümü olduğundan emin olun.',
        });
      }

      const [students, subjects, classrooms] = await Promise.all([
        Student.findAll({
          where: tenantId ? { tenant_id: tenantId } : {},
          attributes: ['id', 'student_number', 'first_name', 'last_name', 'classroom_id', 'school_id'],
        }),
        Subject.findAll({
          where: tenantId ? { tenant_id: tenantId } : {},
          attributes: ['id', 'name'],
        }),
        Classroom.findAll({
          where: tenantId ? { tenant_id: tenantId } : {},
          attributes: ['id', 'class_level', 'section', 'school_id'],
        }),
      ]);

      const rows = attachMatches(parsed.rows, { students, subjects, classrooms });
      const stats = summarizePreview(rows);
      res.json({
        success: true,
        data: {
          title: parsed.title,
          rows,
          stats,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async commitImport(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const payload = req.validatedBody || req.body;
      const schoolId = payload.school_id || null;
      const incoming = payload.rows || [];

      if (schoolId) {
        const school = await School.findByPk(schoolId);
        if (!school || (tenantId && school.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Geçersiz okul' });
        }
      }

      const deduped = [];
      const seen = new Set();
      for (const row of incoming) {
        const key = itemDedupeKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
      }

      let created = 0;
      let preserved = 0;
      let createdSubjects = [];
      await sequelize.transaction(async (transaction) => {
        let rowsToSave = deduped;
        const missingNames = unmatchedSubjectNames(deduped);
        if (missingNames.length && tenantId) {
          createdSubjects = await ensureSubjectsForBranches(tenantId, missingNames, { transaction });
          const subjects = await Subject.findAll({
            where: { tenant_id: tenantId },
            attributes: ['id', 'name'],
            transaction,
          });
          rowsToSave = applySubjectMatches(deduped, subjects);
        }

        const existing = await ResponsibilityExamItem.findAll({
          where: tenantId ? { tenant_id: tenantId } : {},
          transaction,
        });
        const byKey = new Map(existing.map((row) => [itemDedupeKey(row), row]));

        await ResponsibilityExamItem.destroy({
          where: tenantId ? { tenant_id: tenantId } : {},
          transaction,
        });

        const records = rowsToSave.map((row) => {
          const prev = byKey.get(itemDedupeKey(row));
          if (prev && prev.exam_date) preserved += 1;
          created += 1;
          return {
            tenant_id: tenantId,
            school_id: row.school_id || schoolId || null,
            student_id: row.student_id || null,
            classroom_id: row.classroom_id || null,
            student_number: String(row.student_number).trim(),
            student_name: String(row.student_name).trim(),
            current_class_level: row.current_class_level || null,
            current_section: row.current_section || null,
            subject_class_level: String(row.subject_class_level).trim(),
            subject_name: normalizeSubjectLabel(row.subject_name),
            subject_id: row.subject_id || null,
            exam_date: prev ? prev.exam_date : null,
            start_time: prev ? prev.start_time : null,
            oral_exam_date: prev ? prev.oral_exam_date : null,
            oral_start_time: prev ? prev.oral_start_time : null,
            duration_minutes: prev ? prev.duration_minutes : 40,
            teacher_id: prev ? prev.teacher_id : null,
            committee_members: prev ? prev.committee_members : null,
            notes: prev ? prev.notes : null,
          };
        });

        if (records.length) {
          await ResponsibilityExamItem.bulkCreate(records, { transaction });
        }
      });

      await audit.log(req, {
        action: 'create',
        entityType: 'responsibility_exam_import',
        entityId: schoolId,
        summary: `Sorumluluk sınavı Excel içe aktarma: ${created} kayıt` +
          (createdSubjects.length ? `, ${createdSubjects.length} yeni ders` : '') +
          (preserved ? ` (${preserved} tarihten korundu)` : ''),
      });

      res.json({
        success: true,
        data: {
          created,
          preserved,
          skipped_duplicates: incoming.length - deduped.length,
          created_subjects: createdSubjects.length,
          created_subject_names: createdSubjects.map((s) => s.name),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const payload = req.validatedBody || req.body;
      const student = await Student.findByPk(payload.student_id);
      if (!student || (tenantId && student.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Öğrenci bulunamadı' });
      }
      const studentNumber = normalizeStudentNumber(student.student_number);
      if (!studentNumber) {
        return res.status(400).json({ success: false, message: 'Öğrencinin okul numarası yok' });
      }

      let subjectName = normalizeSubjectLabel(payload.subject_name || '');
      let subjectId = payload.subject_id || null;
      if (subjectId) {
        const subject = await Subject.findByPk(subjectId);
        if (!subject || (tenantId && subject.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Ders bulunamadı' });
        }
        if (!subjectName) subjectName = normalizeSubjectLabel(subject.name);
      }
      if (!subjectName) {
        return res.status(400).json({ success: false, message: 'Ders seçin veya ders adını yazın' });
      }

      const subjectLevel = String(payload.subject_class_level).trim();
      const nameKey = subjectName.toLocaleLowerCase('tr-TR');
      const existing = await ResponsibilityExamItem.findAll({
        where: {
          ...(tenantId ? { tenant_id: tenantId } : {}),
          subject_class_level: subjectLevel,
        },
      });
      const groupMate = existing.find(
        (row) => normalizeSubjectLabel(row.subject_name).toLocaleLowerCase('tr-TR') === nameKey,
      );
      if (groupMate) {
        subjectName = groupMate.subject_name;
        if (!subjectId && groupMate.subject_id) subjectId = groupMate.subject_id;
      }

      const duplicate = existing.find((row) => {
        const sameName = normalizeSubjectLabel(row.subject_name).toLocaleLowerCase('tr-TR') === nameKey;
        return sameName && normalizeStudentNumber(row.student_number) === studentNumber;
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Bu öğrencinin bu ders için sorumluluk kaydı zaten var',
        });
      }

      if (!subjectId && tenantId) {
        await ensureSubjectsForBranches(tenantId, [subjectName]);
        const subjects = await Subject.findAll({
          where: { tenant_id: tenantId },
          attributes: ['id', 'name'],
        });
        const matched = applySubjectMatches(
          [{ subject_name: subjectName, subject_id: null, subject_matched: false }],
          subjects,
        );
        subjectId = matched[0]?.subject_id || null;
      }

      const studentName = `${student.first_name || ''} ${student.last_name || ''}`.replace(/\s+/g, ' ').trim();
      const row = await ResponsibilityExamItem.create({
        tenant_id: tenantId,
        school_id: student.school_id || null,
        student_id: student.id,
        classroom_id: student.classroom_id || null,
        student_number: studentNumber,
        student_name: studentName,
        current_class_level: student.class_level || null,
        current_section: student.section || null,
        subject_class_level: subjectLevel,
        subject_name: subjectName,
        subject_id: subjectId,
        exam_date: groupMate ? groupMate.exam_date : null,
        start_time: groupMate ? groupMate.start_time : null,
        oral_exam_date: groupMate ? groupMate.oral_exam_date : null,
        oral_start_time: groupMate ? groupMate.oral_start_time : null,
        committee_members: groupMate ? groupMate.committee_members : null,
        duration_minutes: groupMate ? groupMate.duration_minutes || 40 : 40,
        teacher_id: groupMate ? groupMate.teacher_id : null,
      });

      const full = await ResponsibilityExamItem.findByPk(row.id, { include: itemIncludes });
      await audit.log(req, {
        action: 'create',
        entityType: 'responsibility_exam_item',
        entityId: row.id,
        summary: `Sorumluluk kaydı eklendi: ${studentName} — ${subjectLevel}. ${subjectName}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Bu öğrencinin bu ders için sorumluluk kaydı zaten var',
        });
      }
      next(err);
    }
  },

  async schedule(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const payload = req.validatedBody || req.body;
      const where = subjectGroupWhere(tenantId, payload.subject_class_level, payload.subject_name);
      const groupItems = await ResponsibilityExamItem.findAll({ where });
      if (groupItems.length === 0) {
        return res.status(404).json({ success: false, message: 'Bu ders için sorumluluk kaydı bulunamadı' });
      }

      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
        }
      }

      if (payload.committee_members && payload.committee_members.length) {
        const ids = [...new Set(payload.committee_members.map((m) => m.teacher_id))];
        const teachers = await Teacher.findAll({
          where: { id: ids, ...(tenantId ? { tenant_id: tenantId } : {}) },
          attributes: ['id'],
        });
        if (teachers.length !== ids.length) {
          return res.status(400).json({ success: false, message: 'Komisyon üyelerinden biri bulunamadı' });
        }
      }

      let teacherId = payload.teacher_id;
      if (teacherId === undefined) {
        if (payload.committee_members && payload.committee_members.length) {
          const chair =
            payload.committee_members.find((m) => m.role === 'baskan') || payload.committee_members[0];
          teacherId = chair.teacher_id;
        } else {
          teacherId = groupItems[0].teacher_id;
          if (!teacherId && groupItems[0].subject_id) {
            teacherId = await resolveTeacherFromSchedule(tenantId, groupItems[0].subject_id);
          }
        }
      }

      const writtenDate = payload.exam_date || null;
      const oralDate =
        payload.oral_exam_date !== undefined ? payload.oral_exam_date || null : groupItems[0].oral_exam_date;
      if (asDateOnly(writtenDate) && asDateOnly(writtenDate) === asDateOnly(oralDate)) {
        return res.status(400).json({
          success: false,
          message: 'Yazılı ve sözlü sınav aynı güne konamaz',
        });
      }

      const patch = {
        exam_date: writtenDate,
        start_time: payload.start_time !== undefined ? payload.start_time || null : groupItems[0].start_time,
        oral_exam_date: oralDate,
        oral_start_time:
          payload.oral_start_time !== undefined
            ? payload.oral_start_time || null
            : groupItems[0].oral_start_time,
        duration_minutes: payload.duration_minutes ?? groupItems[0].duration_minutes ?? 40,
        teacher_id: teacherId ?? null,
        committee_members:
          payload.committee_members !== undefined
            ? payload.committee_members
            : groupItems[0].committee_members ?? null,
      };

      const allItems = await ResponsibilityExamItem.findAll({
        where: tenantId ? { tenant_id: tenantId } : {},
      });
      const warning = [overlapWarning(groupItems, allItems, patch.exam_date), overlapWarning(groupItems, allItems, patch.oral_exam_date)]
        .filter(Boolean)
        .join(' ');

      await ResponsibilityExamItem.update(patch, { where });
      const updated = await ResponsibilityExamItem.findAll({ where, include: itemIncludes });

      await audit.log(req, {
        action: 'update',
        entityType: 'responsibility_exam_schedule',
        entityId: updated[0]?.id || null,
        summary: patch.exam_date
          ? `Sorumluluk sınavı tarihlendi: ${payload.subject_class_level}. ${payload.subject_name} → ${patch.exam_date} (${updated.length} öğrenci)`
          : `Sorumluluk sınavı tarihi kaldırıldı: ${payload.subject_class_level}. ${payload.subject_name}`,
      });

      res.json({ success: true, data: updated, warning });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await ResponsibilityExamItem.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = req.validatedBody || req.body;
      if (payload.teacher_id) {
        const teacher = await Teacher.findByPk(payload.teacher_id);
        const tenantId = req.user && req.user.tenant_id;
        if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
        }
      }
      await row.update(payload);
      const full = await ResponsibilityExamItem.findByPk(row.id, { include: itemIncludes });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await ResponsibilityExamItem.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'responsibility_exam_item',
        entityId: id,
        summary: `Sorumluluk sınavı kaydı silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async removeAll(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = tenantId ? { tenant_id: tenantId } : {};
      const count = await ResponsibilityExamItem.count({ where });
      await ResponsibilityExamItem.destroy({ where });
      await audit.log(req, {
        action: 'delete',
        entityType: 'responsibility_exam_item',
        entityId: null,
        summary: `Sorumluluk sınavı kayıtları toplu silindi (${count} kayıt)`,
      });
      res.json({ success: true, data: { deleted: count } });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format } = req.validatedBody || req.body || {};
      const where = tenantId ? { tenant_id: tenantId } : {};
      const rows = await ResponsibilityExamItem.findAll({
        where,
        attributes: [
          'subject_class_level',
          'subject_name',
          'exam_date',
          'start_time',
          'oral_exam_date',
          'oral_start_time',
          'duration_minutes',
          'teacher_id',
          'committee_members',
        ],
      });

      const groups = new Map();
      for (const r of rows) {
        const key = `${r.subject_class_level}|${normalizeSubjectLabel(r.subject_name)}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            subject_class_level: r.subject_class_level,
            subject_name: normalizeSubjectLabel(r.subject_name),
            exam_date: r.exam_date,
            start_time: r.start_time,
            oral_exam_date: r.oral_exam_date,
            oral_start_time: r.oral_start_time,
            duration_minutes: r.duration_minutes,
            teacher_id: r.teacher_id,
            committee_members: r.committee_members,
            student_count: 0,
          };
          groups.set(key, group);
        }
        group.student_count += 1;
      }

      const teacherIds = new Set();
      for (const g of groups.values()) {
        if (g.teacher_id) teacherIds.add(g.teacher_id);
        for (const m of g.committee_members || []) {
          if (m && m.teacher_id) teacherIds.add(m.teacher_id);
        }
      }
      const teachers = teacherIds.size
        ? await Teacher.findAll({
            where: { id: [...teacherIds] },
            attributes: ['id', 'first_name', 'last_name'],
          })
        : [];
      const teacherName = new Map(teachers.map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()]));

      const ROLE_LABELS = { baskan: 'Başkan', uye: 'Üye', gozetmen: 'Gözetmen' };
      function committeeLabel(group) {
        if (group.committee_members && group.committee_members.length) {
          return group.committee_members
            .map((m) => {
              const name = teacherName.get(m.teacher_id) || '';
              const role = ROLE_LABELS[m.role] || ROLE_LABELS.uye;
              return name ? `${name} (${role})` : '';
            })
            .filter(Boolean)
            .join(', ');
        }
        if (group.teacher_id) return teacherName.get(group.teacher_id) || '';
        return '';
      }

      const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      function dayLabel(dateStr) {
        if (!dateStr) return '';
        const d = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(d.getTime())) return '';
        return DAY_NAMES_TR[d.getDay()];
      }

      const sorted = [...groups.values()].sort((a, b) => {
        const dateA = a.exam_date || '9999-99-99';
        const dateB = b.exam_date || '9999-99-99';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const levelCmp = String(a.subject_class_level).localeCompare(String(b.subject_class_level), 'tr', {
          numeric: true,
        });
        if (levelCmp) return levelCmp;
        return a.subject_name.localeCompare(b.subject_name, 'tr');
      });

      await sendTableExport(res, {
        format,
        filename: 'sorumluluk-sinav-programi',
        title: 'Sorumluluk Sınavı Programı',
        headers: [
          'Tarih',
          'Gün',
          'Saat',
          'Sözlü Tarihi',
          'Sözlü Saati',
          'Sorumlu Sınıf',
          'Ders',
          'Komisyon',
          'Süre (dk)',
          'Öğrenci Sayısı',
        ],
        rows: sorted.map((g) => [
          g.exam_date || 'Tarihsiz',
          dayLabel(g.exam_date),
          g.start_time || '',
          g.oral_exam_date || '',
          g.oral_start_time || '',
          g.subject_class_level,
          g.subject_name,
          committeeLabel(g),
          g.duration_minutes || '',
          g.student_count,
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
