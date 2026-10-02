'use strict';

const { Op } = require('sequelize');
const {
  Teacher,
  ScheduleEntry,
  Subject,
  ExtraLessonAbsence,
  DutyAssignment,
  TimetableProject,
} = require('../models');

const DAY_LABELS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SALARY_HOURS = 15;
const SOCIAL_HOURS = 2;
const NIGHT_FROM_MINUTES = 17 * 60;

const CODES = {
  day: { code: '101', label: 'Gündüz' },
  night: { code: '102', label: 'Gece' },
  dutyDay: { code: '119', label: 'Nöbet Görevi (Gündüz)' },
  dutyNight: { code: '121', label: 'Nöbet Görevi (%25 Fazla)' },
  yepDay: { code: '122', label: 'YEP (Gündüz)' },
  yepNight: { code: '123', label: 'YEP (Gece)' },
};

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekday(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

function weekMonday(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const js = date.getDay();
  const diff = js === 0 ? -6 : 1 - js;
  date.setDate(date.getDate() + diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return 8 * 60 + 30;
  return Number(match[1]) * 60 + Number(match[2]);
}

function periodEndMinutes(settings, period) {
  const bell = settings?.bell || {};
  let cursor = parseMinutes(bell.start_time || '08:30');
  const lesson = Number(bell.lesson_minutes) || 40;
  const breakMin = bell.break_minutes == null ? 10 : Number(bell.break_minutes);
  const breaks = Array.isArray(bell.breaks) ? bell.breaks : [];
  for (let current = 1; current <= period; current += 1) {
    cursor += lesson;
    if (current === period) return cursor;
    const listed = breaks[current - 1];
    cursor += listed == null ? breakMin : Number(listed);
  }
  return cursor;
}

function isGuidance(name) {
  return /rehber/i.test(String(name || ''));
}

/** Tam saatleri, dersi olan günlere dengeli yazar. Kalan, saati çok olan güne (beraberlikte erken güne) gider. */
function distributeHours(total, days) {
  const active = days.filter((day) => day.weight > 0);
  const result = new Map(days.map((day) => [day.key, 0]));
  const amount = Math.max(0, Math.floor(Number(total) || 0));
  if (!active.length || amount <= 0) return result;
  const base = Math.floor(amount / active.length);
  let rest = amount % active.length;
  const ranked = [...active].sort((a, b) => b.weight - a.weight || a.order - b.order);
  const bonus = new Set();
  for (const day of ranked) {
    if (rest <= 0) break;
    bonus.add(day.key);
    rest -= 1;
  }
  for (const day of active) {
    result.set(day.key, base + (bonus.has(day.key) ? 1 : 0));
  }
  return result;
}

function addLine(map, code, label, hours) {
  const amount = Number(hours) || 0;
  if (amount <= 0) return;
  const key = code || label;
  const prev = map.get(key) || { code: code || '', label, hours: 0 };
  prev.hours += amount;
  map.set(key, prev);
}

async function loadBell(tenantId, schoolId) {
  if (!schoolId) return null;
  const project = await TimetableProject.findOne({
    where: { tenant_id: tenantId, school_id: schoolId, status: 'published' },
    order: [['published_at', 'DESC']],
  });
  return project?.settings || null;
}

async function buildPayroll({ tenantId, teacherId, year, month, mode }) {
  const teacher = await Teacher.findByPk(teacherId);
  if (!teacher || (tenantId && teacher.tenant_id !== tenantId)) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  const start = isoDate(year, month, 1);
  const end = isoDate(year, month, daysInMonth);
  const settings = await loadBell(tenantId, teacher.school_id);

  const entries = await ScheduleEntry.findAll({
    where: {
      tenant_id: tenantId,
      [Op.or]: [{ teacher_id: teacherId }, { co_teacher_ids: { [Op.contains]: [teacherId] } }],
    },
    include: [{ model: Subject, attributes: ['id', 'name'], required: false }],
  });

  const weekdayHours = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    label: DAY_LABELS[day],
    hours: entries.filter((entry) => entry.day_of_week === day).length,
  }));

  const absences = await ExtraLessonAbsence.findAll({
    where: { tenant_id: tenantId, teacher_id: teacherId, absence_date: { [Op.between]: [start, end] } },
  });
  const absenceByDate = new Map(
    absences.map((row) => [String(row.absence_date).slice(0, 10), row]),
  );

  const slots = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = isoDate(year, month, day);
    const dow = weekday(date);
    for (const entry of entries) {
      if (entry.day_of_week !== dow) continue;
      const endMinute = periodEndMinutes(settings, entry.period_no || 1);
      slots.push({
        date,
        dow,
        period: entry.period_no || 1,
        guidance: isGuidance(entry.Subject?.name),
        night: dow >= 6 || endMinute >= NIGHT_FROM_MINUTES,
        week: weekMonday(date),
      });
    }
  }
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);

  const byDate = new Map();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date).push(slot);
  }

  const kept = [];
  let missed = 0;
  for (const [date, daySlots] of byDate) {
    const absence = absenceByDate.get(date);
    let drop = 0;
    if (absence && absence.reason !== 'kismi') drop = daySlots.length;
    else if (absence && absence.reason === 'kismi') {
      drop = Math.min(daySlots.length, Math.round(Number(absence.missed_hours) || 0));
    }
    missed += drop;
    const usable = daySlots.slice(0, Math.max(0, daySlots.length - drop));
    kept.push(...usable);
  }

  const lines = new Map();
  const weeks = [];
  const grouped = new Map();
  for (const slot of kept) {
    if (!grouped.has(slot.week)) grouped.set(slot.week, []);
    grouped.get(slot.week).push(slot);
  }

  if (mode === 'gorevlendirme') {
    const duties = await DutyAssignment.findAll({
      where: { tenant_id: tenantId, teacher_id: teacherId, duty_date: { [Op.between]: [start, end] } },
    });
    for (const duty of duties) {
      const date = String(duty.duty_date).slice(0, 10);
      const dow = weekday(date);
      const code = dow >= 6 ? CODES.dutyNight : CODES.dutyDay;
      addLine(lines, code.code, code.label, 1);
    }
  }

  for (const [week, weekSlots] of grouped) {
    const countable = mode === 'gorevlendirme' ? weekSlots.filter((slot) => !slot.guidance) : weekSlots;
    const dayMap = new Map();
    countable.forEach((slot, index) => {
      if (!dayMap.has(slot.date)) {
        dayMap.set(slot.date, { key: slot.date, weight: 0, night: 0, order: weekday(slot.date), index });
      }
      const bucket = dayMap.get(slot.date);
      bucket.weight += 1;
      if (slot.night) bucket.night += 1;
    });
    const days = [...dayMap.values()];
    const taught = countable.length;
    const nightCount = countable.filter((slot) => slot.night).length;
    const dayCount = taught - nightCount;

    if (mode === 'gorevlendirme') {
      const salary = Math.min(SALARY_HOURS, taught);
      const extra = Math.max(0, taught - SALARY_HOURS);
      const extraNight = taught === 0 ? 0 : Math.round((extra * nightCount) / taught);
      const extraDay = extra - extraNight;
      const prep = Math.floor(taught / 10);
      const social = taught > 0 ? SOCIAL_HOURS : 0;
      const prepNight = nightCount > dayCount;
      addLine(lines, '', 'Maaş karşılığı', salary);
      addLine(lines, CODES.day.code, CODES.day.label, extraDay);
      addLine(lines, CODES.night.code, CODES.night.label, extraNight);
      addLine(lines, '', 'Sosyal kişilik hizmetleri', social);
      addLine(lines, prepNight ? CODES.yepNight.code : CODES.yepDay.code, prepNight ? CODES.yepNight.label : CODES.yepDay.label, prep);
      const spread = distributeHours(extra, days);
      weeks.push({
        week,
        taught,
        salary,
        extra,
        social,
        prep,
        days: days
          .sort((a, b) => a.order - b.order)
          .map((day) => ({
            date: day.key,
            label: DAY_LABELS[day.order],
            lesson_hours: day.weight,
            extra_hours: spread.get(day.key) || 0,
          })),
      });
    } else {
      const yep = Math.floor(taught / 2);
      const yepNight = nightCount > dayCount;
      addLine(lines, CODES.day.code, CODES.day.label, dayCount);
      addLine(lines, CODES.night.code, CODES.night.label, nightCount);
      addLine(
        lines,
        yepNight ? CODES.yepNight.code : CODES.yepDay.code,
        `${yepNight ? CODES.yepNight.label : CODES.yepDay.label} (her 2 derse 1, buçuk aşağı)`,
        yep,
      );
      const spread = distributeHours(yep, days);
      weeks.push({
        week,
        taught,
        yep,
        days: days
          .sort((a, b) => a.order - b.order)
          .map((day) => ({
            date: day.key,
            label: DAY_LABELS[day.order],
            lesson_hours: day.weight,
            extra_hours: spread.get(day.key) || 0,
          })),
      });
    }
  }

  return {
    mode,
    weekday_hours: weekdayHours.filter((row) => row.day <= 5 || row.hours > 0),
    missed_hours: missed,
    lesson_hours: kept.length,
    lines: [...lines.values()],
    weeks,
    note:
      mode === 'gorevlendirme'
        ? 'İlk 15 saat maaş karşılığıdır. Rehberlik ek derse yazılmaz. Sosyal kişilik ve hazırlık saatleri takvimde görünmez.'
        : 'Girilen her saat ek derstir. Her 2 derse 1 yerine geçen saat puantaja yazılır; takvimde gösterilmez.',
  };
}

module.exports = { buildPayroll, distributeHours };
