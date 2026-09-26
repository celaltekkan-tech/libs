'use strict';

// Otomatik ders programı kısıt türleri. Hem manuel formdan hem Gemini'den
// gelen kısıtlar buradan geçer; solver/timetable_model.py aynı türleri tanır.

const TYPES = {
  teacher_unavailable: {
    label: 'Öğretmen müsait değil',
    fields: ['teacher_id?', 'slots'],
  },
  classroom_unavailable: {
    label: 'Şube kapalı saatler',
    fields: ['classroom_id', 'slots'],
  },
  room_unavailable: {
    label: 'Mekan kapalı saatler',
    fields: ['room_id', 'slots'],
  },
  teacher_max_daily_hours: {
    label: 'Öğretmen günlük azami ders',
    fields: ['teacher_id?', 'max'],
  },
  teacher_min_days_off: {
    label: 'Öğretmen boş gün sayısı',
    fields: ['teacher_id?', 'count'],
  },
  teacher_max_consecutive: {
    label: 'Öğretmen üst üste azami ders',
    fields: ['teacher_id?', 'max'],
  },
  subject_period_preference: {
    label: 'Ders saat tercihi',
    fields: ['subject_id', 'classroom_id?', 'mode', 'periods', 'days?'],
  },
  subject_max_daily: {
    label: 'Ders günlük azami saat',
    fields: ['subject_id', 'classroom_id?', 'max'],
  },
};

const DAY_NAMES = { 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba', 4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi' };

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function intList(v, min, max) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(toInt).filter((n) => n != null && n >= min && n <= max))].sort((a, b) => a - b);
}

/**
 * Parametreleri türüne göre temizler. Hatalıysa Error fırlatır.
 * ctx: { days: number[], periods: number } — gün/saat sınırları için.
 */
function normalizeParams(type, params, ctx) {
  const def = TYPES[type];
  if (!def) throw new Error(`Bilinmeyen kısıt türü: ${type}`);
  const p = params || {};
  const out = {};
  const maxDay = 7;
  const P = ctx?.periods || 12;

  for (const raw of def.fields) {
    const optional = raw.endsWith('?');
    const key = optional ? raw.slice(0, -1) : raw;
    const v = p[key];

    if (['teacher_id', 'classroom_id', 'room_id', 'subject_id'].includes(key)) {
      const id = toInt(v);
      if (id == null || id <= 0) {
        if (!optional) throw new Error(`${def.label}: ${key} zorunlu`);
        out[key] = null;
      } else {
        out[key] = id;
      }
    } else if (key === 'slots') {
      const slots = (Array.isArray(v) ? v : [])
        .map((s) => ({ day: toInt(s?.day), periods: intList(s?.periods, 1, P) }))
        .filter((s) => s.day != null && s.day >= 1 && s.day <= maxDay);
      if (!slots.length) throw new Error(`${def.label}: en az bir gün/saat seçilmeli`);
      out.slots = slots;
    } else if (key === 'max' || key === 'count') {
      const n = toInt(v);
      if (n == null || n < (key === 'count' ? 1 : 1) || n > 12) throw new Error(`${def.label}: ${key} 1-12 arası olmalı`);
      out[key] = n;
    } else if (key === 'mode') {
      out.mode = v === 'only' ? 'only' : 'avoid';
    } else if (key === 'periods') {
      const list = intList(v, 1, P);
      if (!list.length) throw new Error(`${def.label}: en az bir ders saati seçilmeli`);
      out.periods = list;
    } else if (key === 'days') {
      out.days = intList(v, 1, maxDay);
    }
  }
  return out;
}

/** Kısıtın insan okunur Türkçe özeti (liste ve AI önizlemesi için). */
function describe(type, params, names = {}) {
  const p = params || {};
  const t = (id) => (id ? names.teachers?.[id] || `Öğretmen #${id}` : 'Tüm öğretmenler');
  const c = (id) => names.classrooms?.[id] || `Şube #${id}`;
  const r = (id) => names.rooms?.[id] || `Mekan #${id}`;
  const s = (id) => names.subjects?.[id] || `Ders #${id}`;
  const slots = (list) =>
    (list || [])
      .map((x) => `${DAY_NAMES[x.day] || x.day}${x.periods?.length ? ` ${x.periods.join(',')}. saat` : ' (tüm gün)'}`)
      .join('; ');
  const days = (list) => (list?.length ? list.map((d) => DAY_NAMES[d] || d).join(', ') + ' ' : '');
  const scope = (id) => (id ? ` (${c(id)})` : '');

  switch (type) {
    case 'teacher_unavailable':
      return `${t(p.teacher_id)} müsait değil: ${slots(p.slots)}`;
    case 'classroom_unavailable':
      return `${c(p.classroom_id)} ders yok: ${slots(p.slots)}`;
    case 'room_unavailable':
      return `${r(p.room_id)} kullanılamaz: ${slots(p.slots)}`;
    case 'teacher_max_daily_hours':
      return `${t(p.teacher_id)} günde en fazla ${p.max} saat`;
    case 'teacher_min_days_off':
      return `${t(p.teacher_id)} haftada en az ${p.count} boş gün`;
    case 'teacher_max_consecutive':
      return `${t(p.teacher_id)} en fazla ${p.max} saat üst üste`;
    case 'subject_period_preference':
      return `${s(p.subject_id)}${scope(p.classroom_id)} ${days(p.days)}${(p.periods || []).join(',')}. saat${
        p.mode === 'only' ? 'lerde olsun' : 'lere konmasın'
      }`;
    case 'subject_max_daily':
      return `${s(p.subject_id)}${scope(p.classroom_id)} günde en fazla ${p.max} saat`;
    default:
      return type;
  }
}

module.exports = { TYPES, DAY_NAMES, normalizeParams, describe };
