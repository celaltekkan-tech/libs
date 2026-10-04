'use strict';

const { Op } = require('sequelize');
const { LeaveRecord, Teacher, SalaryFormDraft, sequelize } = require('../models');
const { formatDateTR } = require('./promotionFormService');
const { getSalaryPeriodForDate } = require('../utils/salaryPeriod');
const { calendarDate } = require('../utils/calendarDate');

const FREE_REPORT_DAYS = 7;

function isReportPayrollPerson(teacher) {
  if (!teacher || teacher.employment_type === 'ucretli') return false;
  const text = `${teacher.unvan || ''} ${teacher.title_branch || ''} ${teacher.brans || ''} ${teacher.kariyer || ''}`
    .toLocaleLowerCase('tr-TR');
  if (text.includes('müdür')) return true;
  return teacher.personnel_type === 'ogretmen' || teacher.personnel_type === 'memur';
}

function isoDate(value) {
  if (!value) return '';
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eachDate(startIso, endIso) {
  const dates = [];
  const startText = isoDate(startIso);
  const endText = isoDate(endIso);
  const cursor = new Date(`${startText}T12:00:00`);
  const end = new Date(`${endText}T12:00:00`);
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
  const start = Number((calendarDate(startIso) || '').slice(0, 4));
  const end = Number((calendarDate(endIso) || '').slice(0, 4));
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
  if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) return null;
  const uniqueYears = [...new Set((years || []).map(Number).filter((year) => year > 1900))];
  const summary = { yearDays: 0, excessDays: 0, forms: [] };
  for (const year of uniqueYears) {
    const part = await syncYear({ tenantId: teacher.tenant_id, teacher, year });
    summary.yearDays += part.yearDays;
    summary.excessDays += part.excessDays;
    summary.forms.push(...part.forms);
  }
  return summary;
}

async function syncTenantReportYear(tenantId, year) {
  const y = Number(year);
  if (!tenantId || !y) return;
  const leaves = await LeaveRecord.findAll({
    where: {
      tenant_id: tenantId,
      leave_type: 'rapor',
      start_date: { [Op.lte]: `${y}-12-31` },
      end_date: { [Op.gte]: `${y}-01-01` },
    },
    attributes: ['teacher_id'],
  });
  const teacherIds = [...new Set(leaves.map((row) => row.teacher_id).filter(Boolean))];
  for (const teacherId of teacherIds) {
    await syncTeacherReportDays({ tenantId, teacherId, years: [y] });
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

  const rowsByForm = new Map();
  const excessCount = Math.max(0, unique.length - FREE_REPORT_DAYS);
  // Rapor takibindeki "Maaşa yansıyan" ile aynı yazı: "5 gün"
  const daysAfter7Text = excessCount > 0 ? `${excessCount} gün` : '';
  if (isReportPayrollPerson(teacher) && excessCount > 0 && excess.length) {
    const firstDay = excess[0].day;
    const period = getSalaryPeriodForDate(new Date(`${firstDay}T12:00:00`));
    const key = `${period.year}-${period.month}`;
    const list = rowsByForm.get(key) || [];
    list.push({
      source_key: `${prefix}total`,
      personnel_no: teacher.personnel_no || '',
      full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
      national_id: teacher.national_id || '',
      start_date: formatDateTR(firstDay),
      days_after_7: daysAfter7Text,
      documents: 'Sağlık raporu',
    });
    rowsByForm.set(key, list);
  }

  const forms = [];
  await sequelize.transaction(async (transaction) => {
    const drafts = await SalaryFormDraft.findAll({
      where: { tenant_id: tenantId, year: { [Op.in]: [year - 1, year, year + 1] } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byKey = new Map(drafts.map((draft) => [`${draft.year}-${draft.month}`, draft]));
    const keys = new Set([...byKey.keys(), ...rowsByForm.keys()]);
    for (const key of keys) {
      const incoming = rowsByForm.get(key) || [];
      let draft = byKey.get(key);
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
      const nextRows = [...kept, ...incoming];
      if (JSON.stringify(payload.report_days || []) === JSON.stringify(nextRows)) continue;
      payload.report_days = nextRows;
      const [formYear, formMonth] = key.split('-').map(Number);
      if (!draft) {
        draft = await SalaryFormDraft.create(
          {
            tenant_id: tenantId,
            month: formMonth,
            year: formYear,
            payload,
          },
          { transaction },
        );
      } else {
        await draft.update({ payload }, { transaction });
      }
      if (incoming.length) {
        forms.push({
          month: formMonth,
          year: formYear,
          days: incoming.reduce((sum, row) => sum + (parseInt(String(row.days_after_7), 10) || 0), 0),
        });
      }
    }
  });

  return { yearDays: unique.length, excessDays: excess.length, forms };
}

module.exports = {
  syncTeacherReportDays,
  syncTenantReportYear,
  isReportPayrollPerson,
  yearsBetween,
  FREE_REPORT_DAYS,
};
