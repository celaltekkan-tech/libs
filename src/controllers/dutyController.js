'use strict';

const { Op } = require('sequelize');
const { DutyLocation, DutyAssignment, Teacher, LeaveRecord } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const teacherInclude = {
  model: Teacher,
  attributes: ['id', 'first_name', 'last_name', 'personnel_no'],
  required: false,
};

const locationInclude = {
  model: DutyLocation,
  attributes: ['id', 'name'],
  required: false,
};

function dateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function addDays(dateStr_, days) {
  const d = new Date(dateStr_);
  d.setDate(d.getDate() + days);
  return d;
}

async function isTeacherOnLeave(tenantId, teacherId, dateISO, leaveCache) {
  const key = `${teacherId}`;
  if (!leaveCache.has(key)) {
    const leaves = await LeaveRecord.findAll({ where: { tenant_id: tenantId, teacher_id: teacherId } });
    leaveCache.set(key, leaves);
  }
  const leaves = leaveCache.get(key);
  return leaves.some((l) => dateISO >= l.start_date && dateISO <= l.end_date);
}

module.exports = {
  // --- Nöbet yerleri ---
  async listLocations(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      const rows = await DutyLocation.findAll({ where, order: [['name', 'ASC']], limit: 500 });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createLocation(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const row = await DutyLocation.create(payload);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, code: 'DUPLICATE_LOCATION', message: 'Bu isimde bir nöbet yeri zaten var' });
      }
      next(err);
    }
  },

  async updateLocation(req, res, next) {
    try {
      const row = await DutyLocation.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      await row.update(payload);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async removeLocation(req, res, next) {
    try {
      const row = await DutyLocation.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // --- Nöbet atamaları ---
  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.teacher_id) where.teacher_id = Number(req.query.teacher_id);
      if (req.query.duty_location_id) where.duty_location_id = Number(req.query.duty_location_id);
      if (req.query.start_date && req.query.end_date) {
        where.duty_date = { [Op.gte]: req.query.start_date, [Op.lte]: req.query.end_date };
      }

      const rows = await DutyAssignment.findAll({
        where,
        include: [teacherInclude, locationInclude],
        order: [['duty_date', 'ASC']],
        limit: 3000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      const teacher = await Teacher.findByPk(payload.teacher_id);
      if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğretmen bulunamadı' });
      }
      const location = await DutyLocation.findByPk(payload.duty_location_id);
      if (!location || (tenantId && location.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen nöbet yeri bulunamadı' });
      }

      const row = await DutyAssignment.create(payload);
      const full = await DutyAssignment.findByPk(row.id, { include: [teacherInclude, locationInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'duty_assignment',
        entityId: row.id,
        summary: `Nöbet ataması eklendi: ${teacher.first_name} ${teacher.last_name} - ${location.name} - ${dateStr(payload.duty_date)}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUTY_CONFLICT',
          message: 'Bu öğretmen veya bu nöbet yeri o tarihte zaten atanmış',
        });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await DutyAssignment.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const payload = { ...(req.validatedBody || req.body) };
      await row.update(payload);
      const full = await DutyAssignment.findByPk(row.id, { include: [teacherInclude, locationInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'duty_assignment',
        entityId: row.id,
        summary: `Nöbet ataması güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          code: 'DUTY_CONFLICT',
          message: 'Bu öğretmen veya bu nöbet yeri o tarihte zaten atanmış',
        });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await DutyAssignment.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'duty_assignment',
        entityId: id,
        summary: `Nöbet ataması silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  // --- Otomatik nöbet dağıtımı: adil (round-robin, en az atanandan başlar), izinlileri atlar ---
  async generate(req, res, next) {
    try {
      const { start_date, end_date, duty_location_ids, include_weekends } = req.validatedBody || req.body;
      const tenantId = req.user && req.user.tenant_id;

      const locations = await DutyLocation.findAll({
        where: { id: duty_location_ids, tenant_id: tenantId, is_active: true },
      });
      if (locations.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli nöbet yeri bulunamadı' });
      }

      const teachers = await Teacher.findAll({ where: { tenant_id: tenantId }, order: [['id', 'ASC']] });
      if (teachers.length === 0) {
        return res.status(400).json({ success: false, message: 'Tenant üzerinde öğretmen bulunamadı' });
      }

      // Global adalet için tüm zamanlardaki mevcut nöbet sayıları baz alınır.
      const existingCounts = await DutyAssignment.findAll({
        where: { tenant_id: tenantId },
        attributes: ['teacher_id'],
      });
      const counts = new Map(teachers.map((t) => [t.id, 0]));
      existingCounts.forEach((row) => {
        counts.set(row.teacher_id, (counts.get(row.teacher_id) || 0) + 1);
      });

      const leaveCache = new Map();
      let created = 0;
      const skipped = [];

      // Joi (convert:true) start_date/end_date'i Date nesnesine çevirir; döngü
      // boyunca tutarlı karşılaştırma için baştan itibaren string (YYYY-MM-DD) ile çalışılır.
      const endDateStr = dateStr(end_date);
      let cursor = dateStr(start_date);
      while (cursor <= endDateStr) {
        const dow = new Date(cursor).getDay(); // 0=Pazar, 6=Cumartesi
        const isWeekend = dow === 0 || dow === 6;
        if (!isWeekend || include_weekends) {
          const assignedToday = new Set();
          for (const location of locations) {
            const existing = await DutyAssignment.findOne({
              where: { tenant_id: tenantId, duty_location_id: location.id, duty_date: cursor },
            });
            if (existing) {
              assignedToday.add(existing.teacher_id);
              continue;
            }

            const ordered = [...teachers].sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0));
            let chosen = null;
            for (const candidate of ordered) {
              if (assignedToday.has(candidate.id)) continue;
              const onLeave = await isTeacherOnLeave(tenantId, candidate.id, cursor, leaveCache);
              if (onLeave) continue;
              chosen = candidate;
              break;
            }

            if (!chosen) {
              skipped.push({ date: cursor, location: location.name, reason: 'Uygun öğretmen bulunamadı' });
              continue;
            }

            await DutyAssignment.create({
              tenant_id: tenantId,
              teacher_id: chosen.id,
              duty_location_id: location.id,
              duty_date: cursor,
            });
            counts.set(chosen.id, (counts.get(chosen.id) || 0) + 1);
            assignedToday.add(chosen.id);
            created += 1;
          }
        }
        cursor = dateStr(addDays(cursor, 1));
      }

      await audit.log(req, {
        action: 'create',
        entityType: 'duty_assignment_batch',
        summary: `Nöbet programı otomatik oluşturuldu: ${created} kayıt (${start_date} - ${end_date})`,
      });

      res.json({ success: true, data: { created, skipped } });
    } catch (err) {
      next(err);
    }
  },

  // --- Adalet/denge raporu: kişi başına ve yer başına nöbet sayısı ---
  async fairness(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.start_date && req.query.end_date) {
        where.duty_date = { [Op.gte]: req.query.start_date, [Op.lte]: req.query.end_date };
      }

      const rows = await DutyAssignment.findAll({ where, include: [teacherInclude, locationInclude] });

      const byTeacher = new Map();
      const byLocation = new Map();
      rows.forEach((row) => {
        if (row.Teacher) {
          const key = row.teacher_id;
          const name = `${row.Teacher.first_name} ${row.Teacher.last_name}`;
          byTeacher.set(key, { teacher_id: key, teacher_name: name, count: (byTeacher.get(key)?.count || 0) + 1 });
        }
        if (row.DutyLocation) {
          const key = row.duty_location_id;
          byLocation.set(key, {
            duty_location_id: key,
            name: row.DutyLocation.name,
            count: (byLocation.get(key)?.count || 0) + 1,
          });
        }
      });

      res.json({
        success: true,
        data: {
          by_teacher: Array.from(byTeacher.values()).sort((a, b) => b.count - a.count),
          by_location: Array.from(byLocation.values()).sort((a, b) => b.count - a.count),
        },
      });
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
      if (start_date && end_date) where.duty_date = { [Op.gte]: start_date, [Op.lte]: end_date };

      const rows = await DutyAssignment.findAll({
        where,
        include: [teacherInclude, locationInclude],
        order: [
          ['duty_date', 'ASC'],
          ['duty_location_id', 'ASC'],
        ],
        limit: 5000,
      });

      await sendTableExport(res, {
        format,
        filename: 'nobet-cizelgesi',
        title: 'Nöbet Çizelgesi',
        headers: ['Tarih', 'Nöbet Yeri', 'Öğretmen'],
        rows: rows.map((r) => [
          r.duty_date,
          r.DutyLocation?.name || '',
          r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '',
        ]),
      });
    } catch (err) {
      next(err);
    }
  },
};
