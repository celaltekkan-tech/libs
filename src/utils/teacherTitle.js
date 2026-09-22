'use strict';

function foldTr(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '');
}

function normalizeKariyer(value) {
  const folded = foldTr(value);
  if (folded.includes('basogretmen')) return 'Başöğretmen';
  if (folded.includes('uzman')) return 'Uzman Öğretmen';
  return 'Öğretmen';
}

function splitUnvanBrans(text) {
  const raw = String(text || '').trim();
  if (!raw) return { unvan: null, brans: null, kariyerHint: null };
  const paren = /\s*\(([^)]+)\)\s*$/.exec(raw);
  const kariyerHint = paren ? paren[1].trim() : null;
  const base = paren ? raw.slice(0, paren.index).trim() : raw;
  const idx = base.indexOf('/');
  if (idx < 0) return { unvan: base || null, brans: null, kariyerHint };
  const unvan = base.slice(0, idx).trim() || null;
  const brans = base.slice(idx + 1).trim() || null;
  return { unvan, brans, kariyerHint };
}

function composeTitleBranch(unvan, brans) {
  const parts = [unvan, brans]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

function emptyToNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function applyTitleFields(payload, { defaultKariyer = false } = {}) {
  const next = { ...payload };
  let unvan = next.unvan !== undefined ? emptyToNull(next.unvan) : undefined;
  let brans = next.brans !== undefined ? emptyToNull(next.brans) : undefined;

  if (unvan && unvan.includes('/') && !brans) {
    const split = splitUnvanBrans(unvan);
    unvan = split.unvan;
    brans = split.brans;
    if (defaultKariyer && next.kariyer == null && split.kariyerHint) {
      next.kariyer = split.kariyerHint;
    }
  }

  if (unvan !== undefined) next.unvan = unvan;
  if (brans !== undefined) next.brans = brans;

  if (next.kariyer !== undefined) {
    if (next.kariyer == null || String(next.kariyer).trim() === '') {
      next.kariyer = defaultKariyer ? 'Öğretmen' : null;
    } else {
      next.kariyer = normalizeKariyer(next.kariyer);
    }
  } else if (defaultKariyer) {
    next.kariyer = 'Öğretmen';
  }

  if (next.unvan !== undefined || next.brans !== undefined) {
    const composed = composeTitleBranch(next.unvan, next.brans);
    if (composed) next.title_branch = composed;
  }

  return next;
}

function titleFieldsFromMebbisRow(row) {
  const unvan = emptyToNull(row.gorev || row.unvan);
  const brans = emptyToNull(row.brans);
  const isTeacher = (row.personnel_type || 'ogretmen') === 'ogretmen';
  return {
    unvan,
    brans,
    kariyer: isTeacher ? normalizeKariyer(row.seviye_unvani) : null,
    title_branch: composeTitleBranch(unvan, brans),
  };
}

module.exports = {
  normalizeKariyer,
  splitUnvanBrans,
  composeTitleBranch,
  applyTitleFields,
  titleFieldsFromMebbisRow,
};
