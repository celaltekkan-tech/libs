'use strict';

const { Op } = require('sequelize');
const { LeaveRecord, Teacher, SalaryFormDraft, sequelize } = require('../models');
const { formatDateTR } = require('./promotionFormService');

const FREE_REPORT_DAYS = 7;

function isReportPayrollPerson(teacher) {
  if (!teacher || teacher.employment_type === 'ucretli') return false;
  const text = `${teacher.unvan || ''} ${teacher.title_branch || ''} ${teacher.brans || ''} ${teacher.kariyer || ''}`
    .toLocaleLowerCase('tr-TR');
  if (text.includes('müdür')) return true;
  return teacher.personnel_type === 'ogretmen' || teacher.personnel_type === 'memur';
}

function eachDate(startIso, endIso) {
  const dates = [];
  const cursor = new Date(`${String(startIso).slice(0, 10)}T12:00:00`);
  const end = new Date(`${String(endIso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function yearsBetween(startIso, endIso) {
  const start = Number(String(startIso).slice(0, 4));
  const end = Number(String(endIso).slice(0, 4));
  if (!start || !end) return [];
  const years = [];
  for (let year = Math.min(start, end); year <= Math.max(start, end); year += 1) years.push(year);
  return years;
}

/**
 * Takvim yılında 7 günü aşan rapor günlerini ilgili ayın maaş değişikliği formuna yazar.
 * Öğretmen, memur, müdür ve müdür yardımcıları dahildir. Ücretli personel yazılmaz.
 */
async function syncTeacherReportDays({ tenantId, teacherId, years }) {
  const teacher = await Teacher.findByPk(teacherId);
  if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) return;
  const uniqueYears = [...new Set((years || []).map(Number).filter((year) => year > 1900))];
  for (const year of uniqueYears) {
    await syncYear({ tenantId: teacher.tenant_id, teacher, year });
  }
}

async function syncYear({ tenantId, teacher, year }) {
  const prefix = `rapor:${teacher.id}:${year}:`;
  const leaves = await LeaveRecord.findAll({
    where: {
      tenant_id: tenantId,
      teacher_id: teacher.id,
      leave_type: 'rapor',
      start_date: { [Op.lte]: `${year}-12-31` },
      end_date: { [Op.gte]: `${year}-01-01` },
    },
    order: [['start_date', 'ASC'], ['id', 'ASC']],
  });

  const covered = [];
  for (const leave of leaves) {
    for (const day of eachDate(leave.start_date, leave.end_date)) {
      if (!day.startsWith(String(year))) continue;
      covered.push({ day, leaveId: leave.id });
    }
  }
  covered.sort((a, b) => a.day.localeCompare(b.day) || a.leaveId - b.leaveId);
  const seen = new Set();
  const unique = [];
  for (const item of covered) {
    if (seen.has(item.day)) continue;
    seen.add(item.day);
    unique.push(item);
  }
  const excess = unique.slice(FREE_REPORT_DAYS);
  const byLeave = new Map();
  for (const item of excess) {
    const bucket = byLeave.get(item.leaveId) || [];
    bucket.push(item.day);
    byLeave.set(item.leaveId, bucket);
  }

  const rowsByMonth = new Map();
  if (isReportPayrollPerson(teacher)) {
    for (const [leaveId, days] of byLeave) {
      const start = days[0];
      const month = Number(start.slice(5, 7));
      const list = rowsByMonth.get(month) || [];
      list.push({
        source_key: `${prefix}${leaveId}`,
        personnel_no: teacher.personnel_no || '',
        full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
        national_id: teacher.national_id || '',
        start_date: formatDateTR(start),
        days_after_7: days.length,
        documents: 'Sağlık raporu',
      });
      rowsByMonth.set(month, list);
    }
  }

  await sequelize.transaction(async (transaction) => {
    const drafts = await SalaryFormDraft.findAll({
      where: { tenant_id: tenantId, year },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byMonth = new Map(drafts.map((draft) => [draft.month, draft]));
    const months = new Set([...byMonth.keys(), ...rowsByMonth.keys()]);
    for (const month of months) {
      const incoming = rowsByMonth.get(month) || [];
      let draft = byMonth.get(month);
      if (!draft && incoming.length === 0) continue;
      const payload = {
        departures: [],
        starters: [],
        other_changes: [],
        deductions: [],
        report_days: [],
        union_changes: [],
        ...(draft ? draft.payload : {}),
      };
      const kept = (Array.isArray(payload.report_days) ? payload.report_days : []).filter(
        (row) => !String(row?.source_key || '').startsWith(prefix),
      );
      payload.report_days = [...kept, ...incoming];
      if (!draft) {
        draft = await SalaryFormDraft.create(
          {
            tenant_id: tenantId,
            month,
            year,
            payload,
          },
          { transaction },
        );
      } else {
        await draft.update({ payload }, { transaction });
      }
    }
  });
}

module.exports = {
  syncTeacherReportDays,
  isReportPayrollPerson,
  yearsBetween,
  FREE_REPORT_DAYS,
};
