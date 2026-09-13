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
  attributes: ['id', 'name', 'floor_level', 'sort_order'],
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

/** Pazartesi başlangıçlı haftanın ilk günü (YYYY-MM-DD). */
function weekMonday(dateISO) {
  const d = new Date(`${dateISO}T12:00:00`);
  const day = d.getDay(); // 0=Pazar
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

function sortLocations(locations) {
  return [...locations].sort(
    (a, b) =>
      (a.floor_level || 0) - (b.floor_level || 0) ||
      (a.sort_order || 0) - (b.sort_order || 0) ||
      String(a.name).localeCompare(String(b.name), 'tr'),
  );
}

/**
 * Şablon atamayı hafta ofseti kadar kaydırır:
 * - Katlar yukarı kayar (zemin → 1 → 2 → … → zemin)
 * - Aynı kattaki birden fazla nöbetçi sırayla döner
 */
function rotateTeacherMap(locations, baseMap, weekOffset) {
  const sorted = sortLocations(locations);
  const floors = [...new Set(sorted.map((l) => l.floor_level || 0))];
  const locsByFloor = new Map();
  for (const loc of sorted) {
    const f = loc.floor_level || 0;
    if (!locsByFloor.has(f)) locsByFloor.set(f, []);
    locsByFloor.get(f).push(loc);
  }

  const teachersByFloor = new Map();
  for (const floor of floors) {
    const locs = locsByFloor.get(floor) || [];
    teachersByFloor.set(
      floor,
      locs.map((l) => baseMap.get(l.id)).filter((id) => id != null),
    );
  }

  const result = new Map();
  const n = floors.length;
  if (n === 0) return result;

  for (let fi = 0; fi < n; fi += 1) {
    const sourceFloor = floors[fi];
    const targetFloor = floors[(fi + weekOffset) % n];
    const sourceTeachers = teachersByFloor.get(sourceFloor) || [];
    const targetLocs = locsByFloor.get(targetFloor) || [];
    if (sourceTeachers.length === 0 || targetLocs.length === 0) continue;

    const intraShift = weekOffset % sourceTeachers.length;
    const used = new Set();
    for (let i = 0; i < targetLocs.length; i += 1) {
      let chosen = null;
      for (let k = 0; k < sourceTeachers.length; k += 1) {
        const tid = sourceTeachers[(i + intraShift + k) % sourceTeachers.length];
        if (!used.has(tid)) {
          chosen = tid;
          break;
        }
      }
      if (chosen == null) break;
      used.add(chosen);
      result.set(targetLocs[i].id, chosen);
    }
  }
  return result;
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

/**
 * Haftalık kat kaydırması:
 * 1) Aralık başındaki ilk dolu günden (veya adil ilk atamadan) şablon alınır
 * 2) Her sonraki hafta öğretmenler bir üst kata kaydırılır
 * 3) Aynı kattaki birden fazla nöbetçi sırayla döner
 */
async function generateWeeklyRotate({ tenantId, locations, start_date, end_date, include_weekends }) {
  const sortedLocs = sortLocations(locations);
  const locationIds = sortedLocs.map((l) => l.id);
  const endDateStr = dateStr(end_date);
  const startDateStr = dateStr(start_date);
  const leaveCache = new Map();
  const skipped = [];
  let created = 0;

  // Şablon günü bul: aralıkta seçilen yerlerin tamamının dolu olduğu ilk iş günü
  let templateDate = null;
  let baseMap = new Map();
  let probe = startDateStr;
  while (probe <= endDateStr) {
    const dow = new Date(probe + 'T12:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend || include_weekends) {
      const dayRows = await DutyAssignment.findAll({
        where: {
          tenant_id: tenantId,
          duty_date: probe,
          duty_location_id: { [Op.in]: locationIds },
        },
      });
      if (dayRows.length >= locationIds.length) {
        templateDate = probe;
        baseMap = new Map(dayRows.map((r) => [r.duty_location_id, r.teacher_id]));
        break;
      }
      if (dayRows.length > 0 && !templateDate) {
        // Kısmi şablon: en azından dolu yerleri kullan, boşları sonra doldur
        templateDate = probe;
        baseMap = new Map(dayRows.map((r) => [r.duty_location_id, r.teacher_id]));
      }
    }
    probe = dateStr(addDays(probe, 1));
  }

  // Şablon yoksa ilk iş gününe adil atama yaparak şablon oluştur
  if (baseMap.size < locationIds.length) {
    const teachers = await Teacher.findAll({ where: { tenant_id: tenantId }, order: [['id', 'ASC']] });
    if (teachers.length === 0) {
      return {
        created: 0,
        skipped: [{ date: startDateStr, location: '-', reason: 'Tenant üzerinde öğretmen bulunamadı' }],
      };
    }
    const counts = new Map(teachers.map((t) => [t.id, 0]));
    const existingCounts = await DutyAssignment.findAll({
      where: { tenant_id: tenantId },
      attributes: ['teacher_id'],
    });
    existingCounts.forEach((row) => {
      counts.set(row.teacher_id, (counts.get(row.teacher_id) || 0) + 1);
    });

    let firstWorkday = startDateStr;
    while (firstWorkday <= endDateStr) {
      const dow = new Date(firstWorkday + 'T12:00:00').getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (!isWeekend || include_weekends) break;
      firstWorkday = dateStr(addDays(firstWorkday, 1));
    }
    templateDate = templateDate || firstWorkday;

    const assigned = new Set([...baseMap.values()]);
    for (const loc of sortedLocs) {
      if (baseMap.has(loc.id)) continue;
      const ordered = [...teachers].sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0));
      let chosen = null;
      for (const candidate of ordered) {
        if (assigned.has(candidate.id)) continue;
        const onLeave = await isTeacherOnLeave(tenantId, candidate.id, templateDate, leaveCache);
        if (onLeave) continue;
        chosen = candidate;
        break;
      }
      if (!chosen) {
        skipped.push({ date: templateDate, location: loc.name, reason: 'Şablon için uygun öğretmen yok' });
        continue;
      }
      baseMap.set(loc.id, chosen.id);
      assigned.add(chosen.id);
      counts.set(chosen.id, (counts.get(chosen.id) || 0) + 1);
    }
  }

  if (baseMap.size === 0) {
    return {
      created: 0,
      skipped: [{ date: startDateStr, location: '-', reason: 'Haftalık kaydırma için şablon oluşturulamadı' }],
    };
  }

  const templateMonday = weekMonday(templateDate);

  // Aralık içindeki her gün için ilgili hafta ofsetini hesapla ve yaz
  let cursor = startDateStr;
  while (cursor <= endDateStr) {
    const dow = new Date(cursor + 'T12:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend || include_weekends) {
      const monday = weekMonday(cursor);
      const weekOffset = Math.round(
        (new Date(monday + 'T12:00:00') - new Date(templateMonday + 'T12:00:00')) / (7 * 24 * 3600 * 1000),
      );
      const offset = ((weekOffset % 1000) + 1000) % 1000; // negatif olmasın
      const dayMap = rotateTeacherMap(sortedLocs, baseMap, offset);
      const assignedToday = new Set();

      for (const loc of sortedLocs) {
        const existing = await DutyAssignment.findOne({
          where: { tenant_id: tenantId, duty_location_id: loc.id, duty_date: cursor },
        });
        if (existing) {
          assignedToday.add(existing.teacher_id);
          continue;
        }

        let teacherId = dayMap.get(loc.id);
        if (teacherId == null || assignedToday.has(teacherId)) {
          skipped.push({
            date: cursor,
            location: loc.name,
            reason: teacherId == null ? 'Kaydırma sonucu öğretmen yok' : 'Öğretmen o gün başka yerde',
          });
          continue;
        }

        const onLeave = await isTeacherOnLeave(tenantId, teacherId, cursor, leaveCache);
        if (onLeave) {
          // Aynı kattaki sıradaki yedek (şablondaki diğer öğretmenler)
          const alternates = [...dayMap.values()].filter((id) => id !== teacherId && !assignedToday.has(id));
          let replaced = null;
          for (const alt of alternates) {
            if (!(await isTeacherOnLeave(tenantId, alt, cursor, leaveCache))) {
              replaced = alt;
              break;
            }
          }
          if (replaced == null) {
            skipped.push({ date: cursor, location: loc.name, reason: 'Öğretmen izinli, yedek yok' });
            continue;
          }
          teacherId = replaced;
        }

        try {
          await DutyAssignment.create({
            tenant_id: tenantId,
            teacher_id: teacherId,
            duty_location_id: loc.id,
            duty_date: cursor,
          });
          assignedToday.add(teacherId);
          created += 1;
        } catch (err) {
          if (err.name === 'SequelizeUniqueConstraintError') {
            skipped.push({ date: cursor, location: loc.name, reason: 'Çakışma' });
          } else {
            throw err;
          }
        }
      }
    }
    cursor = dateStr(addDays(cursor, 1));
  }

  return { created, skipped, template_date: templateDate };
}

module.exports = {
  // --- Nöbet yerleri ---
  async listLocations(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      const rows = await DutyLocation.findAll({
        where,
        order: [
          ['floor_level', 'ASC'],
          ['sort_order', 'ASC'],
          ['name', 'ASC'],
        ],
        limit: 500,
      });
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

  // --- Otomatik nöbet dağıtımı: fair (adil) veya weekly_rotate (kat kaydırma) ---
  async generate(req, res, next) {
    try {
      const body = req.validatedBody || req.body;
      const { start_date, end_date, duty_location_ids, include_weekends } = body;
      const mode = body.mode || 'fair';
      const tenantId = req.user && req.user.tenant_id;

      const locations = await DutyLocation.findAll({
        where: { id: duty_location_ids, tenant_id: tenantId, is_active: true },
      });
      if (locations.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli nöbet yeri bulunamadı' });
      }

      if (mode === 'weekly_rotate') {
        const result = await generateWeeklyRotate({
          tenantId,
          locations,
          start_date,
          end_date,
          include_weekends: Boolean(include_weekends),
        });
        await audit.log(req, {
          action: 'create',
          entityType: 'duty_assignment_batch',
          summary: `Nöbet haftalık kat kaydırması: ${result.created} kayıt (${dateStr(start_date)} - ${dateStr(end_date)})`,
        });
        return res.json({ success: true, data: result });
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
