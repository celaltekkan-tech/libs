'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  TimetableProject,
  TimetableRoom,
  TimetableAssignment,
  TimetableConstraint,
  TimetableRun,
  TimetableLesson,
  ScheduleEntry,
  SubjectClassHour,
  Classroom,
  Subject,
  Teacher,
  School,
} = require('../models');
const audit = require('../services/auditService');
const licenseService = require('../services/licenseService');
const solver = require('../services/timetableSolverClient');
const runService = require('../services/timetableRunService');
const gemini = require('../services/geminiService');
const aiUsage = require('../services/aiUsageService');
const { TYPES, DAY_NAMES, normalizeParams, describe } = require('../services/timetableConstraintCatalog');
const {
  buildPayload,
  projectSettings,
  parseBlockPattern,
  classroomLabel,
  teacherName,
} = require('../services/timetableBuildService');

function tenantOf(req) {
  return req.user && req.user.tenant_id;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, next, err) {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ success: false, ...(err.code ? { code: err.code } : {}), message: err.message });
  }
  if (err instanceof solver.SolverUnavailableError) return res.status(503).json({ success: false, message: err.message });
  if (err instanceof gemini.GeminiError) return res.status(err.status).json({ success: false, message: err.message });
  return next(err);
}

async function loadProject(req) {
  const id = Number(req.params.projectId || req.params.id);
  const project = await TimetableProject.findByPk(id);
  if (!project) throw httpError(404, 'Program çalışması bulunamadı');
  if (tenantOf(req) && project.tenant_id !== tenantOf(req)) throw httpError(403, 'Erişim reddedildi');
  return project;
}

async function loadChild(req, Model, label) {
  const row = await Model.findByPk(Number(req.params.id));
  if (!row) throw httpError(404, `${label} bulunamadı`);
  if (tenantOf(req) && row.tenant_id !== tenantOf(req)) throw httpError(403, 'Erişim reddedildi');
  return row;
}

async function assertSchool(req, schoolId) {
  const school = await School.findByPk(schoolId);
  if (!school || (tenantOf(req) && school.tenant_id !== tenantOf(req))) throw httpError(400, 'Okul bulunamadı');
  return school;
}

// Projenin okuluna ait şubeler (eğitim yılı eşleşenler ya da yılı boş olanlar).
async function projectClassrooms(project) {
  const where = { tenant_id: project.tenant_id, school_id: project.school_id, is_active: true };
  if (project.academic_year) {
    where[Op.or] = [{ academic_year: project.academic_year }, { academic_year: null }, { academic_year: '' }];
  }
  return Classroom.findAll({ where, order: [['class_level', 'ASC'], ['section', 'ASC']] });
}

async function nameMaps(project) {
  const [assignments, rooms] = await Promise.all([
    TimetableAssignment.findAll({
      where: { project_id: project.id },
      include: [
        { model: Classroom, attributes: ['id', 'class_level', 'section'] },
        { model: Subject, attributes: ['id', 'name'] },
        { model: Teacher, as: 'Teacher', attributes: ['id', 'first_name', 'last_name', 'brans'] },
      ],
    }),
    TimetableRoom.findAll({ where: { tenant_id: project.tenant_id, school_id: project.school_id } }),
  ]);
  const maps = { teachers: {}, classrooms: {}, subjects: {}, rooms: {} };
  const teacherBrans = {};
  for (const a of assignments) {
    if (a.Teacher) {
      maps.teachers[a.teacher_id] = teacherName(a.Teacher);
      teacherBrans[a.teacher_id] = a.Teacher.brans || '';
    }
    if (a.Classroom) maps.classrooms[a.classroom_id] = classroomLabel(a.Classroom);
    if (a.Subject) maps.subjects[a.subject_id] = a.Subject.name;
  }
  for (const r of rooms) maps.rooms[r.id] = r.name;
  return { maps, teacherBrans, rooms };
}

function serializeConstraint(c, maps) {
  const json = c.toJSON();
  json.summary = describe(c.type, c.params, maps);
  json.type_label = TYPES[c.type]?.label || c.type;
  return json;
}

const PROJECT_FIELDS = ['name', 'academic_year', 'days', 'periods_per_day', 'lunch_after', 'settings'];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const assignmentIncludes = [
  { model: Classroom, attributes: ['id', 'class_level', 'section'] },
  { model: Subject, attributes: ['id', 'name', 'code', 'difficulty_level'] },
  { model: Teacher, as: 'Teacher', attributes: ['id', 'first_name', 'last_name', 'brans'] },
  { model: TimetableRoom, as: 'Room', attributes: ['id', 'name'] },
];

async function validateAssignmentRefs(req, project, payload) {
  const tenantId = tenantOf(req);
  for (const k of ['block_pattern', 'sync_group']) {
    if (typeof payload[k] === 'string') payload[k] = payload[k].trim() || null;
  }
  if (payload.classroom_id != null) {
    const c = await Classroom.findByPk(payload.classroom_id);
    if (!c || c.tenant_id !== project.tenant_id) throw httpError(400, 'Şube bulunamadı');
  }
  if (payload.subject_id != null) {
    const s = await Subject.findByPk(payload.subject_id);
    if (!s || (tenantId && s.tenant_id !== tenantId)) throw httpError(400, 'Ders bulunamadı');
  }
  if (payload.teacher_id != null) {
    const t = await Teacher.findByPk(payload.teacher_id);
    if (!t || t.tenant_id !== project.tenant_id) throw httpError(400, 'Öğretmen bulunamadı');
  }
  if (payload.room_id != null) {
    const r = await TimetableRoom.findByPk(payload.room_id);
    if (!r || r.tenant_id !== project.tenant_id || r.school_id !== project.school_id) throw httpError(400, 'Mekan bulunamadı');
  }
  if (payload.block_pattern) {
    const blocks = parseBlockPattern(payload.block_pattern);
    const hours = payload.weekly_hours;
    if (!blocks) throw httpError(400, 'Blok düzeni "2+2+1" biçiminde olmalı');
    if (hours != null && blocks.reduce((a, b) => a + b, 0) !== hours) {
      throw httpError(400, `Blok düzeninin toplamı haftalık saate (${hours}) eşit olmalı`);
    }
    payload.block_pattern = blocks.join('+');
  }
}

async function projectConstraintCtx(project) {
  return { days: project.days || [1, 2, 3, 4, 5], periods: project.periods_per_day || 8 };
}

// Taslak dersleri ızgara için zenginleştirilmiş biçimde döner.
async function lessonsWithAssignments(project) {
  return TimetableLesson.findAll({
    where: { project_id: project.id },
    include: [{ model: TimetableAssignment, as: 'Assignment', include: assignmentIncludes }],
    order: [['day_of_week', 'ASC'], ['period_no', 'ASC']],
  });
}

// Bir dersin (day, period) hücresine taşınması durumunda oluşacak çakışmalar.
function findConflicts(lessons, moving, day, period, ignoreIds = new Set()) {
  const a = moving.Assignment;
  const conflicts = [];
  for (const l of lessons) {
    if (l.id === moving.id || ignoreIds.has(l.id)) continue;
    if (l.day_of_week !== day || l.period_no !== period) continue;
    const b = l.Assignment;
    if (!b) continue;
    const sameSync = a.sync_group && b.sync_group && a.sync_group === b.sync_group;
    if (!sameSync && a.teacher_id && a.teacher_id === b.teacher_id) {
      conflicts.push(`${teacherName(a.Teacher)} bu saatte ${classroomLabel(b.Classroom)} sınıfında (${b.Subject?.name})`);
    }
    if (!sameSync && a.classroom_id === b.classroom_id) {
      conflicts.push(`${classroomLabel(a.Classroom)} bu saatte ${b.Subject?.name} dersinde`);
    }
  }
  return conflicts;
}

module.exports = {
  // ---------------------------------------------------------------- meta
  async meta(req, res, next) {
    try {
      let solverOk = false;
      try {
        await solver.health();
        solverOk = true;
      } catch {
        solverOk = false;
      }
      const aiConfigured = gemini.isEnabled();
      const aiLicense = await licenseService.getActiveAiLicense(tenantOf(req));
      const aiLicensed = Boolean(aiLicense);
      res.json({
        success: true,
        data: {
          ai_configured: aiConfigured,
          ai_licensed: aiLicensed,
          ai_enabled: aiConfigured && aiLicensed,
          ai_model: aiConfigured && aiLicensed ? gemini.config().model : null,
          ai_usage: aiLicensed ? await aiUsage.getUsage(tenantOf(req), aiUsage.resolveLimit(aiLicense)) : null,
          solver_available: solverOk,
          constraint_types: Object.entries(TYPES).map(([key, v]) => ({ key, label: v.label, fields: v.fields })),
          default_settings: projectSettings({ settings: {} }),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // ---------------------------------------------------------------- projects
  async listProjects(req, res, next) {
    try {
      const where = {};
      if (tenantOf(req)) where.tenant_id = tenantOf(req);
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      const projects = await TimetableProject.findAll({
        where,
        include: [{ model: School, attributes: ['id', 'name'] }],
        order: [['updated_at', 'DESC']],
      });
      res.json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  },

  async getProject(req, res, next) {
    try {
      const project = await loadProject(req);
      const [assignmentCount, constraintCount, lessonCount] = await Promise.all([
        TimetableAssignment.count({ where: { project_id: project.id } }),
        TimetableConstraint.count({ where: { project_id: project.id } }),
        TimetableLesson.count({ where: { project_id: project.id } }),
      ]);
      res.json({
        success: true,
        data: {
          ...project.toJSON(),
          settings: projectSettings(project),
          counts: { assignments: assignmentCount, constraints: constraintCount, lessons: lessonCount },
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async createProject(req, res, next) {
    try {
      const body = req.validatedBody;
      await assertSchool(req, body.school_id);
      const project = await TimetableProject.create({
        ...pick(body, PROJECT_FIELDS),
        tenant_id: tenantOf(req),
        school_id: body.school_id,
        status: 'taslak',
        created_by: req.user.user_id || null,
      });
      await audit.log(req, {
        action: 'create',
        entityType: 'timetable_project',
        entityId: project.id,
        summary: `Otomatik ders programı çalışması oluşturuldu: ${project.name}`,
      });
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updateProject(req, res, next) {
    try {
      const project = await loadProject(req);
      const body = pick(req.validatedBody, PROJECT_FIELDS);
      if (body.settings) body.settings = { ...(project.settings || {}), ...body.settings };
      await project.update(body);
      res.json({ success: true, data: project });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async deleteProject(req, res, next) {
    try {
      const project = await loadProject(req);
      await project.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'timetable_project',
        entityId: project.id,
        summary: `Otomatik ders programı çalışması silindi: ${project.name}`,
      });
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- rooms
  async listRooms(req, res, next) {
    try {
      const where = {};
      if (tenantOf(req)) where.tenant_id = tenantOf(req);
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      const rooms = await TimetableRoom.findAll({ where, order: [['name', 'ASC']] });
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  },

  async createRoom(req, res, next) {
    try {
      const body = req.validatedBody;
      await assertSchool(req, body.school_id);
      const room = await TimetableRoom.create({ ...body, tenant_id: tenantOf(req) });
      res.status(201).json({ success: true, data: room });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updateRoom(req, res, next) {
    try {
      const room = await loadChild(req, TimetableRoom, 'Mekan');
      const { school_id: _ignored, ...body } = req.validatedBody;
      await room.update(body);
      res.json({ success: true, data: room });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async deleteRoom(req, res, next) {
    try {
      const room = await loadChild(req, TimetableRoom, 'Mekan');
      await room.destroy();
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- assignments
  async listAssignments(req, res, next) {
    try {
      const project = await loadProject(req);
      const rows = await TimetableAssignment.findAll({
        where: { project_id: project.id },
        include: assignmentIncludes,
        order: [['id', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async createAssignment(req, res, next) {
    try {
      const project = await loadProject(req);
      const payload = { ...req.validatedBody };
      await validateAssignmentRefs(req, project, payload);
      const row = await TimetableAssignment.create({ ...payload, tenant_id: project.tenant_id, project_id: project.id });
      const full = await TimetableAssignment.findByPk(row.id, { include: assignmentIncludes });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updateAssignment(req, res, next) {
    try {
      const row = await loadChild(req, TimetableAssignment, 'Ders ataması');
      const project = await TimetableProject.findByPk(row.project_id);
      const payload = { ...req.validatedBody };
      if (payload.block_pattern && payload.weekly_hours == null) payload.weekly_hours = row.weekly_hours;
      if (payload.weekly_hours != null && payload.block_pattern === undefined && row.block_pattern) {
        const sum = parseBlockPattern(row.block_pattern).reduce((a, b) => a + b, 0);
        if (sum !== payload.weekly_hours) payload.block_pattern = null;
      }
      await validateAssignmentRefs(req, project, payload);
      await row.update(payload);
      const full = await TimetableAssignment.findByPk(row.id, { include: assignmentIncludes });
      res.json({ success: true, data: full });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async bulkUpdateAssignments(req, res, next) {
    try {
      const project = await loadProject(req);
      const { ids, ...changes } = req.validatedBody;
      await validateAssignmentRefs(req, project, { ...changes, block_pattern: undefined });
      const [count] = await TimetableAssignment.update(changes, { where: { project_id: project.id, id: ids } });
      res.json({ success: true, data: { updated: count } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async deleteAssignment(req, res, next) {
    try {
      const row = await loadChild(req, TimetableAssignment, 'Ders ataması');
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Şubelerin seviyesine göre "Ders Saatleri" tanımlarından atama üretir;
  // öğretmeni mevcut ders programından (ScheduleEntry) tahmin eder.
  async generateAssignments(req, res, next) {
    try {
      const project = await loadProject(req);
      const { overwrite } = req.validatedBody;
      const classrooms = await projectClassrooms(project);
      if (!classrooms.length) throw httpError(400, 'Bu okulda aktif şube bulunamadı');

      const classIds = classrooms.map((c) => c.id);
      const [classHours, scheduleRows, existing] = await Promise.all([
        SubjectClassHour.findAll({ where: { tenant_id: project.tenant_id } }),
        ScheduleEntry.findAll({
          where: { tenant_id: project.tenant_id, classroom_id: classIds },
          attributes: ['classroom_id', 'subject_id', 'teacher_id', 'academic_year'],
        }),
        TimetableAssignment.findAll({ where: { project_id: project.id } }),
      ]);

      // (şube, ders) -> {saat, öğretmen sayımları}
      const fromSchedule = new Map();
      for (const e of scheduleRows) {
        if (project.academic_year && e.academic_year && e.academic_year !== project.academic_year) continue;
        const key = `${e.classroom_id}:${e.subject_id}`;
        const cur = fromSchedule.get(key) || { hours: 0, teachers: new Map() };
        cur.hours += 1;
        if (e.teacher_id) cur.teachers.set(e.teacher_id, (cur.teachers.get(e.teacher_id) || 0) + 1);
        fromSchedule.set(key, cur);
      }
      const topTeacher = (key) => {
        const cur = fromSchedule.get(key);
        if (!cur || !cur.teachers.size) return null;
        return [...cur.teachers.entries()].sort((a, b) => b[1] - a[1])[0][0];
      };

      const hoursByLevel = new Map();
      for (const h of classHours) {
        if (!h.weekly_hours) continue;
        const list = hoursByLevel.get(String(h.class_level)) || [];
        list.push(h);
        hoursByLevel.set(String(h.class_level), list);
      }

      const existingKeys = new Set(existing.map((a) => `${a.classroom_id}:${a.subject_id}`));
      const rows = [];
      const planned = new Set();
      for (const c of classrooms) {
        for (const h of hoursByLevel.get(String(c.class_level)) || []) {
          const key = `${c.id}:${h.subject_id}`;
          planned.add(key);
          rows.push({ key, classroom_id: c.id, subject_id: h.subject_id, weekly_hours: h.weekly_hours, teacher_id: topTeacher(key) });
        }
      }
      // Ders saati tanımı olmayan ama programda geçen dersler.
      for (const [key, cur] of fromSchedule.entries()) {
        if (planned.has(key)) continue;
        const [classroomId, subjectId] = key.split(':').map(Number);
        rows.push({ key, classroom_id: classroomId, subject_id: subjectId, weekly_hours: cur.hours, teacher_id: topTeacher(key) });
      }

      let created = 0;
      let skipped = 0;
      await sequelize.transaction(async (transaction) => {
        if (overwrite) {
          await TimetableAssignment.destroy({ where: { project_id: project.id }, transaction });
          existingKeys.clear();
        }
        const toCreate = rows.filter((r) => {
          if (existingKeys.has(r.key)) {
            skipped += 1;
            return false;
          }
          return true;
        });
        await TimetableAssignment.bulkCreate(
          toCreate.map(({ key: _key, ...r }) => ({ ...r, tenant_id: project.tenant_id, project_id: project.id })),
          { transaction }
        );
        created = toCreate.length;
      });

      res.json({
        success: true,
        data: {
          created,
          skipped,
          without_teacher: rows.filter((r) => !r.teacher_id).length,
          classrooms: classrooms.length,
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- constraints
  async listConstraints(req, res, next) {
    try {
      const project = await loadProject(req);
      const [rows, { maps }] = await Promise.all([
        TimetableConstraint.findAll({ where: { project_id: project.id }, order: [['id', 'ASC']] }),
        nameMaps(project),
      ]);
      await fillTeacherNames(maps, rows);
      res.json({ success: true, data: rows.map((c) => serializeConstraint(c, maps)) });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async createConstraints(req, res, next) {
    try {
      const project = await loadProject(req);
      const ctx = await projectConstraintCtx(project);
      const items = req.validatedBody.items;
      const rows = [];
      for (const [i, item] of items.entries()) {
        let params;
        try {
          params = normalizeParams(item.type, item.params, ctx);
        } catch (err) {
          throw httpError(400, `${i + 1}. kısıt: ${err.message}`);
        }
        rows.push({
          tenant_id: project.tenant_id,
          project_id: project.id,
          type: item.type,
          is_hard: item.is_hard,
          weight: item.is_hard ? null : item.weight ?? 20,
          params,
          source: item.source || 'manuel',
          source_text: item.source_text || null,
          is_active: true,
        });
      }
      const created = await TimetableConstraint.bulkCreate(rows, { returning: true });
      if (created.some((c) => c.source === 'ai')) {
        await audit.log(req, {
          action: 'create',
          entityType: 'timetable_constraint',
          entityId: project.id,
          summary: `Yapay zeka önerisiyle ${created.length} kısıt eklendi (${project.name})`,
        });
      }
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updateConstraint(req, res, next) {
    try {
      const row = await loadChild(req, TimetableConstraint, 'Kısıt');
      const project = await TimetableProject.findByPk(row.project_id);
      const body = { ...req.validatedBody };
      if (body.params) body.params = normalizeParams(row.type, body.params, await projectConstraintCtx(project));
      if (body.is_hard === true) body.weight = null;
      if (body.is_hard === false && body.weight == null && row.weight == null) body.weight = 20;
      await row.update(body);
      res.json({ success: true, data: row });
    } catch (err) {
      if (!err.status && /zorunlu|olmalı|seçilmeli|Bilinmeyen/.test(err.message)) err.status = 400;
      sendError(res, next, err);
    }
  },

  async deleteConstraint(req, res, next) {
    try {
      const row = await loadChild(req, TimetableConstraint, 'Kısıt');
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Serbest metni Gemini ile kısıt önerilerine çevirir; kaydetmez.
  async aiParse(req, res, next) {
    try {
      const project = await loadProject(req);
      const aiLicense = await licenseService.getActiveAiLicense(tenantOf(req));
      if (!aiLicense) {
        return res.status(403).json({
          success: false,
          code: 'AI_LICENSE_REQUIRED',
          message: 'Yapay zekâ özellikleri için "Yapay Zekâ" eklenti lisansı gerekir. Platform yöneticisinden isteyin.',
        });
      }
      if (!gemini.isEnabled()) throw httpError(503, 'Yapay zeka asistanı etkin değil (GEMINI_API_KEY tanımlı değil)');
      const { maps, teacherBrans, rooms } = await nameMaps(project);

      // Atamalarda henüz geçmeyen öğretmenler de isimle anılabilir.
      const schoolTeachers = await Teacher.findAll({
        where: { tenant_id: project.tenant_id, school_id: project.school_id },
        attributes: ['id', 'first_name', 'last_name', 'brans', 'personnel_type'],
      });
      for (const t of schoolTeachers) {
        if (t.personnel_type && t.personnel_type !== 'ogretmen') continue;
        if (!maps.teachers[t.id]) {
          maps.teachers[t.id] = teacherName(t);
          teacherBrans[t.id] = t.brans || '';
        }
      }
      const classrooms = await projectClassrooms(project);
      for (const c of classrooms) maps.classrooms[c.id] ||= classroomLabel(c);

      const ctx = {
        days: project.days || [1, 2, 3, 4, 5],
        periods: project.periods_per_day || 8,
        lunchAfter: project.lunch_after || null,
        dayNames: DAY_NAMES,
        teachers: Object.entries(maps.teachers).map(([id, name]) => ({ id: Number(id), name, brans: teacherBrans[id] })),
        classrooms: Object.entries(maps.classrooms).map(([id, label]) => ({ id: Number(id), label })),
        subjects: Object.entries(maps.subjects).map(([id, name]) => ({ id: Number(id), name })),
        rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
      };
      if (!ctx.subjects.length) {
        const subjects = await Subject.findAll({ where: { tenant_id: project.tenant_id, is_active: true } });
        ctx.subjects = subjects.map((s) => ({ id: s.id, name: s.name }));
      }

      const usage = await aiUsage.consume(tenantOf(req), aiUsage.resolveLimit(aiLicense));
      let result;
      try {
        result = await gemini.parseConstraints(ctx, req.validatedBody.text);
      } catch (err) {
        await aiUsage.refund(tenantOf(req));
        usage.used -= 1;
        throw err;
      }
      res.json({ success: true, data: { ...result, usage } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- solve
  async check(req, res, next) {
    try {
      const project = await loadProject(req);
      const payload = await buildPayload(project);
      const result = await solver.check(payload);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async startRun(req, res, next) {
    try {
      const project = await loadProject(req);
      const run = await runService.startRun(project, {
        userId: req.user.user_id,
        timeLimit: req.validatedBody.time_limit,
      });
      await audit.log(req, {
        action: 'create',
        entityType: 'timetable_run',
        entityId: run.id,
        summary: `Otomatik ders programı oluşturma başlatıldı (${project.name}, ${run.time_limit} sn)`,
      });
      res.status(202).json({ success: true, data: run });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async listRuns(req, res, next) {
    try {
      const project = await loadProject(req);
      const runs = await TimetableRun.findAll({
        where: { project_id: project.id },
        attributes: { exclude: ['result'] },
        order: [['id', 'DESC']],
        limit: 20,
      });
      res.json({ success: true, data: runs });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async getRun(req, res, next) {
    try {
      const run = await loadChild(req, TimetableRun, 'Çalıştırma');
      const json = run.toJSON();
      // Ders listesi büyük; özet yeterli.
      if (json.result) {
        json.result = {
          lesson_count: json.result.lessons?.length || 0,
          score: json.result.score,
          violations: json.result.violations,
        };
      }
      res.json({ success: true, data: json });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async cancelRun(req, res, next) {
    try {
      const run = await loadChild(req, TimetableRun, 'Çalıştırma');
      await runService.cancelRun(run);
      res.json({ success: true, data: run });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async applyRun(req, res, next) {
    try {
      const run = await loadChild(req, TimetableRun, 'Çalıştırma');
      await runService.applyRun(run);
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- lessons
  async listLessons(req, res, next) {
    try {
      const project = await loadProject(req);
      res.json({ success: true, data: await lessonsWithAssignments(project) });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Bir ders saatini başka hücreye taşır. Hedefte aynı şubenin başka bir
  // dersi varsa yer değiştirir. Öğretmen çakışması varsa force olmadan reddeder.
  async moveLesson(req, res, next) {
    try {
      const lesson = await loadChild(req, TimetableLesson, 'Ders');
      const project = await TimetableProject.findByPk(lesson.project_id);
      const { day_of_week: day, period_no: period, force } = req.validatedBody;
      if (!(project.days || []).includes(day) || period < 1 || period > project.periods_per_day) {
        throw httpError(400, 'Geçersiz gün/saat');
      }
      const lessons = await lessonsWithAssignments(project);
      const moving = lessons.find((l) => l.id === lesson.id);

      const swapWith = lessons.find(
        (l) =>
          l.id !== moving.id &&
          l.day_of_week === day &&
          l.period_no === period &&
          l.Assignment?.classroom_id === moving.Assignment.classroom_id &&
          !(moving.Assignment.sync_group && l.Assignment.sync_group === moving.Assignment.sync_group)
      );

      const conflicts = findConflicts(lessons, moving, day, period, new Set(swapWith ? [swapWith.id] : []));
      if (swapWith) {
        const back = findConflicts(lessons, swapWith, moving.day_of_week, moving.period_no, new Set([moving.id]));
        conflicts.push(...back);
      }
      if (conflicts.length && !force) {
        return res.status(409).json({ success: false, message: 'Çakışma var', conflicts: [...new Set(conflicts)] });
      }

      await sequelize.transaction(async (transaction) => {
        if (swapWith) {
          await TimetableLesson.update(
            { day_of_week: moving.day_of_week, period_no: moving.period_no },
            { where: { id: swapWith.id }, transaction }
          );
        }
        await TimetableLesson.update({ day_of_week: day, period_no: period }, { where: { id: moving.id }, transaction });
      });
      res.json({ success: true, data: { swapped_with: swapWith?.id || null, conflicts } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async setLessonLock(req, res, next) {
    try {
      const lesson = await loadChild(req, TimetableLesson, 'Ders');
      await lesson.update({ is_locked: req.validatedBody.is_locked });
      res.json({ success: true, data: lesson });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async lockAll(req, res, next) {
    try {
      const project = await loadProject(req);
      const where = { project_id: project.id };
      const { is_locked: locked, classroom_id: classroomId, teacher_id: teacherId } = req.validatedBody;
      if (classroomId || teacherId) {
        const aWhere = { project_id: project.id };
        if (classroomId) aWhere.classroom_id = classroomId;
        if (teacherId) aWhere.teacher_id = teacherId;
        const ids = (await TimetableAssignment.findAll({ where: aWhere, attributes: ['id'] })).map((a) => a.id);
        where.assignment_id = ids;
      }
      const [count] = await TimetableLesson.update({ is_locked: locked }, { where });
      res.json({ success: true, data: { updated: count } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async clearLessons(req, res, next) {
    try {
      const project = await loadProject(req);
      await TimetableLesson.destroy({ where: { project_id: project.id } });
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Taslağı resmi ders programına (ScheduleEntries) yazar. Projedeki
  // şubelerin o eğitim yılına ait mevcut kayıtları silinip yeniden oluşturulur.
  async publish(req, res, next) {
    try {
      const project = await loadProject(req);
      const lessons = await lessonsWithAssignments(project);
      if (!lessons.length) throw httpError(400, 'Yayınlanacak taslak program yok');

      const classIds = [...new Set(lessons.map((l) => l.Assignment.classroom_id))];
      const year = project.academic_year || null;
      const teacherSlots = new Set();
      const classSlots = new Set();
      let teacherDropped = 0;
      let classDropped = 0;
      const rows = [];
      for (const l of lessons) {
        const a = l.Assignment;
        const cKey = `${a.classroom_id}:${l.day_of_week}:${l.period_no}`;
        // Senkron gruplarda aynı şubenin paralel dersleri tek kayda iner.
        if (classSlots.has(cKey)) {
          classDropped += 1;
          continue;
        }
        classSlots.add(cKey);
        let teacherId = a.teacher_id || null;
        if (teacherId) {
          const tKey = `${teacherId}:${l.day_of_week}:${l.period_no}`;
          if (teacherSlots.has(tKey)) {
            teacherId = null;
            teacherDropped += 1;
          } else {
            teacherSlots.add(tKey);
          }
        }
        rows.push({
          tenant_id: project.tenant_id,
          school_id: project.school_id,
          classroom_id: a.classroom_id,
          subject_id: a.subject_id,
          teacher_id: teacherId,
          day_of_week: l.day_of_week,
          period_no: l.period_no,
          academic_year: year,
        });
      }

      // Okulun tüm şubelerinin o yıla ait kayıtları değişir; diğer okullara dokunulmaz.
      const schoolClassIds = (
        await Classroom.findAll({ where: { tenant_id: project.tenant_id, school_id: project.school_id }, attributes: ['id'] })
      ).map((c) => c.id);

      await sequelize.transaction(async (transaction) => {
        await ScheduleEntry.destroy({
          where: {
            tenant_id: project.tenant_id,
            academic_year: year,
            classroom_id: [...new Set([...schoolClassIds, ...classIds])],
          },
          transaction,
        });
        try {
          await ScheduleEntry.bulkCreate(rows, { transaction });
        } catch (err) {
          if (err.name === 'SequelizeUniqueConstraintError') {
            throw httpError(409, 'Bazı öğretmenlerin başka okuldaki ders programıyla çakışması var; yayınlanamadı.');
          }
          throw err;
        }
        await TimetableProject.update(
          { status: 'arsiv' },
          { where: { tenant_id: project.tenant_id, school_id: project.school_id, status: 'yayinda', id: { [Op.ne]: project.id } }, transaction }
        );
        await project.update({ status: 'yayinda', published_at: new Date() }, { transaction });
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'timetable_project',
        entityId: project.id,
        summary: `Otomatik ders programı yayınlandı: ${project.name} (${rows.length} ders saati)`,
      });
      res.json({
        success: true,
        data: { published: rows.length, classrooms: classIds.length, teacher_dropped: teacherDropped, class_dropped: classDropped },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  },
};

// Kısıtlarda geçip atamalarda olmayan öğretmen adlarını tamamlar.
async function fillTeacherNames(maps, rows) {
  const missing = [...new Set(rows.map((c) => c.params?.teacher_id).filter((id) => id && !maps.teachers[id]))];
  if (!missing.length) return;
  const teachers = await Teacher.findAll({ where: { id: missing }, attributes: ['id', 'first_name', 'last_name'] });
  for (const t of teachers) maps.teachers[t.id] = teacherName(t);
}
