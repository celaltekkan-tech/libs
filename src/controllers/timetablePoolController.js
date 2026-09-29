'use strict';

// Otomatik ders programı: branşlar, ders havuzu ve zaman tablosu (müsaitlik).
// Hesap (tenant) projeden alınır; platform yöneticisi de aynı uçları kullanabilir.

const { Op } = require('sequelize');
const { sequelize, TimetableProject, TimetableAvailability, Branch, Subject, SubjectClassHour } = require('../models');
const branchService = require('../services/branchService');
const { parseBlockPattern } = require('../services/timetableBuildService');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, next, err) {
  if (err.status && err.status < 500) return res.status(err.status).json({ success: false, message: err.message });
  return next(err);
}

async function loadProject(req) {
  const project = await TimetableProject.findByPk(Number(req.params.projectId));
  if (!project) throw httpError(404, 'Program çalışması bulunamadı');
  const tenantId = req.user && req.user.tenant_id;
  if (tenantId && project.tenant_id !== tenantId) throw httpError(403, 'Erişim reddedildi');
  return project;
}

const POOL_SUBJECT_FIELDS = [
  'id',
  'name',
  'code',
  'difficulty_level',
  'branch_id',
  'allow_split',
  'allow_merge',
  'is_elective',
  'course_kind',
  'elective_group',
  'is_guidance',
  'is_activity',
  'is_active',
];

function blockPatternFor(hours, pattern) {
  if (!pattern) return null;
  const blocks = parseBlockPattern(pattern);
  if (!blocks) throw httpError(400, 'Blok düzeni "2+2+1" biçiminde olmalı');
  if (blocks.reduce((a, b) => a + b, 0) !== hours) {
    throw httpError(400, `Blok düzeninin toplamı haftalık saate (${hours}) eşit olmalı`);
  }
  return blocks.join('+');
}

/** Hücre haritasını temizler: yalnız proje gün/saat aralığındaki closed/avoid hücreler kalır. */
function cleanCells(project, cells) {
  const days = new Set([1, 2, 3, 4, 5, 6, 7]);
  const P = project.periods_per_day || 8;
  const out = {};
  for (const [key, state] of Object.entries(cells || {})) {
    const [d, p] = key.split('-').map(Number);
    if (!days.has(d) || p < 1 || p > P) continue;
    if (state === 'closed' || state === 'avoid') out[`${d}-${p}`] = state;
  }
  return out;
}

module.exports = {
  // ---------------------------------------------------------------- branşlar
  async listBranches(req, res, next) {
    try {
      const project = await loadProject(req);
      await branchService.syncBranches(project.tenant_id);
      res.json({ success: true, data: await branchService.listBranches(project.tenant_id) });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async createBranch(req, res, next) {
    try {
      const project = await loadProject(req);
      const { name, code } = req.validatedBody;
      if (await branchService.nameTaken(project.tenant_id, name)) throw httpError(409, 'Bu adda branş zaten var');
      const row = await Branch.create({ tenant_id: project.tenant_id, name, code: code || null });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updateBranch(req, res, next) {
    try {
      const project = await loadProject(req);
      const row = await Branch.findByPk(Number(req.params.id));
      if (!row || row.tenant_id !== project.tenant_id) throw httpError(404, 'Branş bulunamadı');
      const body = { ...req.validatedBody };
      if (body.name && (await branchService.nameTaken(project.tenant_id, body.name, row.id))) {
        throw httpError(409, 'Bu adda branş zaten var');
      }
      if (body.code === '') body.code = null;
      await row.update(body);
      res.json({ success: true, data: row });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async deleteBranch(req, res, next) {
    try {
      const project = await loadProject(req);
      const row = await Branch.findByPk(Number(req.params.id));
      if (!row || row.tenant_id !== project.tenant_id) throw httpError(404, 'Branş bulunamadı');
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- ders havuzu
  async getPool(req, res, next) {
    try {
      const project = await loadProject(req);
      await branchService.syncBranches(project.tenant_id);
      const [subjects, hours, branches] = await Promise.all([
        Subject.findAll({
          where: { tenant_id: project.tenant_id },
          attributes: POOL_SUBJECT_FIELDS,
          order: [['name', 'ASC']],
        }),
        SubjectClassHour.findAll({ where: { tenant_id: project.tenant_id } }),
        branchService.listBranches(project.tenant_id),
      ]);
      res.json({ success: true, data: { subjects, hours, branches } });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  async updatePoolSubject(req, res, next) {
    try {
      const project = await loadProject(req);
      const subject = await Subject.findByPk(Number(req.params.id));
      if (!subject || subject.tenant_id !== project.tenant_id) throw httpError(404, 'Ders bulunamadı');
      const body = { ...req.validatedBody };
      if (body.branch_id) {
        const branch = await Branch.findByPk(body.branch_id);
        if (!branch || branch.tenant_id !== project.tenant_id) throw httpError(400, 'Branş bulunamadı');
      }
      for (const k of ['code', 'elective_group']) if (body[k] === '') body[k] = null;
      if (body.is_elective === false) body.elective_group = null;
      await subject.update(body);
      res.json({ success: true, data: await Subject.findByPk(subject.id, { attributes: POOL_SUBJECT_FIELDS }) });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Aynı ders ve seviyede birden fazla saat olabilir. 0 saat, id ile tek seçeneği siler.
  async upsertPoolHour(req, res, next) {
    try {
      const project = await loadProject(req);
      const {
        id: hourId,
        subject_id: subjectId,
        class_level: level,
        weekly_hours: hours,
        block_pattern: pattern,
      } = req.validatedBody;
      const subject = await Subject.findByPk(subjectId);
      if (!subject || subject.tenant_id !== project.tenant_id) throw httpError(400, 'Ders bulunamadı');
      const where = { tenant_id: project.tenant_id, subject_id: subjectId, class_level: level };

      if (!hours) {
        if (hourId) {
          const row = await SubjectClassHour.findOne({ where: { ...where, id: hourId } });
          if (row) await row.destroy();
        } else {
          await SubjectClassHour.destroy({ where });
        }
        return res.json({ success: true, data: null });
      }

      const blockPattern = blockPatternFor(hours, pattern);
      const clash = await SubjectClassHour.findOne({
        where: { ...where, weekly_hours: hours, ...(hourId ? { id: { [Op.ne]: hourId } } : {}) },
      });
      if (clash && !hourId) {
        await clash.update({ block_pattern: blockPattern });
        return res.json({ success: true, data: clash });
      }
      if (clash) throw httpError(409, 'Bu seviyede bu saat zaten var');

      if (hourId) {
        const row = await SubjectClassHour.findOne({ where: { ...where, id: hourId } });
        if (!row) throw httpError(404, 'Saat kaydı bulunamadı');
        await row.update({ weekly_hours: hours, block_pattern: blockPattern });
        return res.json({ success: true, data: row });
      }

      const saved = await SubjectClassHour.create({ ...where, weekly_hours: hours, block_pattern: blockPattern });
      res.json({ success: true, data: saved });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // ---------------------------------------------------------------- zaman tablosu
  async listAvailability(req, res, next) {
    try {
      const project = await loadProject(req);
      const rows = await TimetableAvailability.findAll({ where: { project_id: project.id } });
      res.json({ success: true, data: rows });
    } catch (err) {
      sendError(res, next, err);
    }
  },

  // Birden çok öğretmen/şube/mekan/derse aynı hücreleri uygular (toplu aç/kapat).
  async saveAvailability(req, res, next) {
    try {
      const project = await loadProject(req);
      const { entity_type: type, mode, cells } = req.validatedBody;
      const ids = type === 'school' ? [0] : req.validatedBody.entity_ids.filter((x) => x > 0);
      if (!ids.length) throw httpError(400, 'Kayıt seçilmedi');

      const saved = await sequelize.transaction(async (transaction) => {
        const existing = await TimetableAvailability.findAll({
          where: { project_id: project.id, entity_type: type, entity_id: ids },
          transaction,
        });
        const byId = new Map(existing.map((r) => [r.entity_id, r]));
        const out = [];
        for (const id of ids) {
          const row = byId.get(id);
          let next = {};
          if (mode === 'patch') {
            next = { ...(row?.cells || {}) };
            for (const [key, state] of Object.entries(cells)) {
              if (state === 'open') delete next[key];
              else next[key] = state;
            }
          } else {
            next = cells;
          }
          next = cleanCells(project, next);
          if (row) {
            await row.update({ cells: next }, { transaction });
            out.push(row);
          } else {
            out.push(
              await TimetableAvailability.create(
                { tenant_id: project.tenant_id, project_id: project.id, entity_type: type, entity_id: id, cells: next },
                { transaction },
              ),
            );
          }
        }
        return out;
      });
      res.json({ success: true, data: saved });
    } catch (err) {
      sendError(res, next, err);
    }
  },
};
