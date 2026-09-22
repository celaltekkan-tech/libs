'use strict';

const FREQUENCIES = ['once', 'daily', 'weekly', 'monthly', 'yearly'];
const STATUSES = ['active', 'paused', 'completed', 'cancelled'];
const NOTIFY_CHANNELS = ['in_app', 'sms', 'email'];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Europe/Istanbul offset-aware basit dönüşüm (DST: yaz/kış). */
function istanbulParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function istanbulToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second));
  const p = istanbulParts(guess);
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const gotLocalMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const diff = targetLocalMs - gotLocalMs;
  return new Date(guess.getTime() + diff);
}

function addDays(parts, days) {
  const base = istanbulToUtc({ ...parts, hour: parts.hour ?? 0, minute: parts.minute ?? 0 });
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

function computeNextDueAt(fromDate, frequency, recurrenceConfig = {}) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  if (Number.isNaN(base.getTime())) return null;
  if (frequency === 'once') return base;

  const p = istanbulParts(base);
  const cfg = recurrenceConfig || {};

  if (frequency === 'daily') {
    return addDays(p, 1);
  }

  if (frequency === 'weekly') {
    return addDays(p, 7);
  }

  if (frequency === 'monthly') {
    const day = Math.min(Number(cfg.day) || p.day, 28);
    let month = p.month + 1;
    let year = p.year;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return istanbulToUtc({ year, month, day, hour: p.hour, minute: p.minute });
  }

  if (frequency === 'yearly') {
    const month = Number(cfg.month) || p.month;
    const day = Number(cfg.day) || p.day;
    return istanbulToUtc({ year: p.year + 1, month, day, hour: p.hour, minute: p.minute });
  }

  return base;
}

/**
 * Takvim aralığı için tekrarlayan görev oluşumlarını üretir (Europe/Istanbul).
 * @returns {Date[]}
 */
function expandOccurrencesInRange(task, from, to) {
  const due = new Date(task.next_due_at);
  if (Number.isNaN(due.getTime())) return [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const frequency = task.frequency || 'once';
  const cfg = task.recurrence_config || {};
  const p = istanbulParts(due);

  if (frequency === 'once') {
    const t = due.getTime();
    return t >= fromMs && t <= toMs ? [due] : [];
  }

  if (frequency === 'daily') {
    const out = [];
    // Görünen aralıktaki her gün, görevin saatini koruyarak
    let cursor = istanbulToUtc({
      year: istanbulParts(from).year,
      month: istanbulParts(from).month,
      day: istanbulParts(from).day,
      hour: p.hour,
      minute: p.minute,
    });
    if (cursor.getTime() < fromMs) cursor = addDays(istanbulParts(cursor), 1);
    while (cursor.getTime() <= toMs) {
      out.push(cursor);
      cursor = addDays(istanbulParts(cursor), 1);
    }
    return out;
  }

  if (frequency === 'weekly') {
    const out = [];
    // next_due_at'in hafta gününü koruyarak aralık içinde ileri/geri üret
    let cursor = due;
    while (cursor.getTime() > fromMs) {
      const prev = addDays(istanbulParts(cursor), -7);
      if (prev.getTime() < fromMs - 7 * 86400000) break;
      cursor = prev;
    }
    while (cursor.getTime() < fromMs) {
      cursor = addDays(istanbulParts(cursor), 7);
    }
    while (cursor.getTime() <= toMs) {
      out.push(cursor);
      cursor = addDays(istanbulParts(cursor), 7);
    }
    return out;
  }

  if (frequency === 'monthly') {
    const day = Math.min(Number(cfg.day) || p.day, 28);
    const out = [];
    const start = istanbulParts(from);
    const end = istanbulParts(to);
    let year = start.year;
    let month = start.month;
    while (year < end.year || (year === end.year && month <= end.month)) {
      const occ = istanbulToUtc({
        year,
        month,
        day,
        hour: p.hour,
        minute: p.minute,
      });
      if (occ.getTime() >= fromMs && occ.getTime() <= toMs) out.push(occ);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return out;
  }

  if (frequency === 'yearly') {
    const month = Number(cfg.month) || p.month;
    const day = Math.min(Number(cfg.day) || p.day, 28);
    const out = [];
    const startY = istanbulParts(from).year;
    const endY = istanbulParts(to).year;
    for (let year = startY; year <= endY; year += 1) {
      const occ = istanbulToUtc({ year, month, day, hour: p.hour, minute: p.minute });
      if (occ.getTime() >= fromMs && occ.getTime() <= toMs) out.push(occ);
    }
    return out;
  }

  return [];
}

function isOccurrenceComplete(task) {
  if (!task.last_completed_at) return false;
  return new Date(task.last_completed_at).getTime() >= new Date(task.next_due_at).getTime();
}

function normalizeNotifyChannels(channels) {
  if (!Array.isArray(channels)) return [];
  return channels.filter((c) => NOTIFY_CHANNELS.includes(c));
}

module.exports = {
  FREQUENCIES,
  STATUSES,
  NOTIFY_CHANNELS,
  computeNextDueAt,
  expandOccurrencesInRange,
  isOccurrenceComplete,
  normalizeNotifyChannels,
  istanbulParts,
  istanbulToUtc,
};
