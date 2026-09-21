'use strict';

// Terfi/kademe kuralları:
// - Derece 15'ten 1'e kadar iner (küçülme = terfi).
// - Her derecede 3 kademe (1,2,3) bulunur; sadece derece 1'de 4 kademe (1,2,3,4) vardır.
// - Tavan: derece 1 / kademe 4 — ötesine ilerleme yoktur.

const MIN_DEGREE = 1;

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getMaxRank(degree) {
  return toInt(degree) === MIN_DEGREE ? 4 : 3;
}

function isAtCeiling(degree, rank) {
  return toInt(degree) === MIN_DEGREE && toInt(rank) >= 4;
}

/** Yıllık veya 8 yıllık ceza-siz kademe ilerlemesi: kademe +1, dolarsa derece -1 + kademe 1. */
function advanceDegreeRank(degree, rank) {
  const deg = toInt(degree);
  const rk = toInt(rank);
  if (deg == null || rk == null) {
    return { degree: degree ?? null, rank: rank ?? null, atCeiling: false, changed: false };
  }
  if (isAtCeiling(deg, rk)) {
    return { degree: String(deg), rank: String(rk), atCeiling: true, changed: false };
  }
  const maxRank = getMaxRank(deg);
  if (rk < maxRank) {
    return { degree: String(deg), rank: String(rk + 1), atCeiling: false, changed: true };
  }
  const nextDegree = Math.max(MIN_DEGREE, deg - 1);
  return { degree: String(nextDegree), rank: '1', atCeiling: false, changed: true };
}

/** Uzman Öğretmen / Başöğretmen unvanına geçişte tek seferlik derece -1 (kademe değişmez). */
function applyCareerDegreeDrop(degree) {
  const deg = toInt(degree);
  if (deg == null || deg <= MIN_DEGREE) {
    return { degree: deg == null ? (degree ?? null) : String(deg), changed: false };
  }
  return { degree: String(deg - 1), changed: true };
}

/** Kariyer basamağında bir sonraki unvan: Öğretmen → Uzman Öğretmen → Başöğretmen. Başöğretmen'in ötesi yok. */
function nextKariyerTitle(kariyer) {
  if (kariyer === 'Öğretmen') return 'Uzman Öğretmen';
  if (kariyer === 'Uzman Öğretmen') return 'Başöğretmen';
  return null;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** baseDate'in ay/gün'ü today ile aynı mı (yıl bağımsız), yoksa false. */
function isAnniversary(baseDate, today) {
  if (!baseDate) return false;
  const b = new Date(baseDate);
  const t = today instanceof Date ? today : new Date(today);
  return b.getMonth() === t.getMonth() && b.getDate() === t.getDate();
}

/**
 * baseDate'ten bugüne kaç tam 8 yıllık dönem geçti ve sıradaki kontrol tarihi ne.
 * Ceza bildirildiğinde veya 8 yıllık bonus uygulandığında baseDate o tarihe taşınmalı,
 * böylece sayaç sıfırdan başlar.
 */
function eightYearProgress(baseDate, today) {
  if (!baseDate) return { periodsCompleted: 0, nextCheckpoint: null, isCheckpointDue: false };
  const base = new Date(baseDate);
  const t = today instanceof Date ? today : new Date(today);

  let yearsElapsed = t.getFullYear() - base.getFullYear();
  const monthDayPassed =
    t.getMonth() > base.getMonth() || (t.getMonth() === base.getMonth() && t.getDate() >= base.getDate());
  if (!monthDayPassed) yearsElapsed -= 1;

  const periodsCompleted = Math.max(0, Math.floor(yearsElapsed / 8));
  const nextCheckpoint = addYears(base, (periodsCompleted + 1) * 8);
  const currentCheckpoint = periodsCompleted > 0 ? addYears(base, periodsCompleted * 8) : null;
  const isCheckpointDue = periodsCompleted > 0 && t.getTime() >= currentCheckpoint.getTime();

  return { periodsCompleted, nextCheckpoint, currentCheckpoint, isCheckpointDue };
}

module.exports = {
  getMaxRank,
  isAtCeiling,
  advanceDegreeRank,
  applyCareerDegreeDrop,
  nextKariyerTitle,
  addYears,
  isAnniversary,
  eightYearProgress,
};
