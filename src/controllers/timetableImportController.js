'use strict';

const { TimetableProject } = require('../models');
const audit = require('../services/auditService');
const { previewProgram, importProgram } = require('../services/timetableProgramImport');

function tenantOf(req) {
  return req.user?.tenant_id ?? null;
}

async function loadProject(req) {
  const project = await TimetableProject.findByPk(Number(req.params.projectId));
  if (!project) {
    const err = new Error('Program çalışması bulunamadı');
    err.status = 404;
    throw err;
  }
  if (tenantOf(req) && project.tenant_id !== tenantOf(req)) {
    const err = new Error('Erişim reddedildi');
    err.status = 403;
    throw err;
  }
  return project;
}

function readOverrides(body) {
  let raw = body?.overrides;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      const err = new Error('Eşleştirme düzeltmesi okunamadı');
      err.status = 400;
      throw err;
    }
  }
  const pick = (source) => {
    const out = {};
    if (!source || typeof source !== 'object') return out;
    for (const [key, value] of Object.entries(source)) {
      const id = Number(value);
      if (String(key).trim() && Number.isInteger(id) && id > 0) out[String(key)] = id;
    }
    return out;
  };
  return {
    subjects: pick(raw.subjects),
    teachers: pick(raw.teachers),
    classrooms: pick(raw.classrooms),
  };
}

function send(res, next, err) {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return next(err);
}

module.exports = {
  async preview(req, res, next) {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'PDF veya Excel dosyası gerekli' });
      }
      const project = await loadProject(req);
      const data = await previewProgram(project, req.file.buffer, req.file.originalname);
      res.json({ success: true, data });
    } catch (err) {
      send(res, next, err);
    }
  },

  async commit(req, res, next) {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'PDF veya Excel dosyası gerekli' });
      }
      const project = await loadProject(req);
      const replace = req.body.replace_existing === true || req.body.replace_existing === 'true' || req.body.replace_existing === '1';
      const data = await importProgram(project, req.file.buffer, req.file.originalname, {
        replace,
        overrides: readOverrides(req.body),
      });
      await audit.log(req, {
        action: 'import',
        entityType: 'timetable_lesson',
        entityId: project.id,
        summary: `Ders programı içe aktarıldı (${data.format_label}): ${data.lessons} saat yerleşti`,
      });
      res.json({ success: true, data });
    } catch (err) {
      send(res, next, err);
    }
  },
};
