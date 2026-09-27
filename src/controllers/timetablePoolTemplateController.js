'use strict';

// Okul tarafı: platformdaki hazır ders havuzlarını listeleme ve okulun havuzuna aktarma.

const { LessonPoolTemplate, TimetableProject, School, Classroom, Subject } = require('../models');
const audit = require('../services/auditService');
const { importTemplate, suggestMatches } = require('../services/lessonPoolTemplateService');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, next, err) {
  if (err.status && err.status < 500) return res.status(err.status).json({ success: false, message: err.message });
  return next(err);
}

async function loadProject(req, id) {
  const project = await TimetableProject.findByPk(Number(id));
  if (!project) throw httpError(404, 'Program çalışması bulunamadı');
  const tenantId = req.user && req.user.tenant_id;
  if (tenantId && project.tenant_id !== tenantId) throw httpError(403, 'Erişim reddedildi');
  return project;
}

module.exports = {
  // Aktif şablonlar; okul türüne uyanlar önce gelir.
  async list(req, res, next) {
    try {
      const project = await loadProject(req, req.query.project_id);
      const [school, classrooms, rows, subjects] = await Promise.all([
        School.findByPk(project.school_id, { attributes: ['id', 'school_type'] }),
        Classroom.findAll({
          where: { tenant_id: project.tenant_id, school_id: project.school_id, is_active: true },
          attributes: ['class_level'],
        }),
        LessonPoolTemplate.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
        Subject.findAll({ where: { tenant_id: project.tenant_id }, attributes: ['id', 'name', 'is_active'], order: [['name', 'ASC']] }),
      ]);
      const type = school?.school_type || null;
      const data = rows
        .map((t) => ({
          id: t.id,
          name: t.name,
          school_type: t.school_type,
          levels: t.levels,
          note: t.note,
          items: t.items,
          matches: suggestMatches(t.items || [], subjects),
          matches_school: !t.school_type || !type || t.school_type === type,
        }))
        .sort((a, b) => Number(b.matches_school) - Number(a.matches_school) || a.name.localeCompare(b.name, 'tr'));
      const levels = [...new Set(classrooms.map((c) => c.class_level).filter(Boolean))];
      res.json({
        success: true,
        data: {
          templates: data,
          school_type: type,
          class_levels: levels,
          subjects: subjects.map((s) => ({ id: s.id, name: s.name, is_active: s.is_active })),
        },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async importToPool(req, res, next) {
    try {
      const project = await loadProject(req, req.params.projectId);
      const { template_id: templateId, level_map: rawMap, mode, kinds, subject_map: subjectMap } = req.validatedBody;
      const template = await LessonPoolTemplate.findByPk(templateId);
      if (!template || !template.is_active) throw httpError(404, 'Hazır ders havuzu bulunamadı');
      const levelMap = {};
      for (const [from, to] of Object.entries(rawMap)) {
        if (to && (template.levels || []).includes(from)) levelMap[from] = String(to).trim();
      }
      if (!Object.keys(levelMap).length) throw httpError(400, 'En az bir sınıf seviyesi eşleştirin');
      if (subjectMap) {
        const ids = [...new Set(Object.values(subjectMap).filter((v) => v))];
        if (ids.length) {
          const own = await Subject.count({ where: { id: ids, tenant_id: project.tenant_id } });
          if (own !== ids.length) throw httpError(400, 'Eşleştirilen derslerden biri bulunamadı');
        }
      }
      const stats = await importTemplate({
        tenantId: project.tenant_id,
        template,
        levelMap,
        mode,
        kinds,
        subjectMap: subjectMap || null,
      });
      await audit.log(req, {
        action: 'create',
        entityType: 'subject_class_hour',
        entityId: template.id,
        summary: `Hazır ders havuzu aktarıldı: ${template.name} (${stats.subjects_created} yeni ders, ${stats.hours_created} saat)`,
      });
      res.json({ success: true, data: stats });
    } catch (err) {
      sendError(res, next, err);
    }
  },
};
