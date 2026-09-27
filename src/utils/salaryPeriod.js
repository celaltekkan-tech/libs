'use strict';

const { advanceDegreeRank } = require('./promotionEngine');

/**
 * Maaş Değişikliği Bildirim Formu'ndaki "ilgili ay" için yaygın dönem:
 * seçilen ayın 14'ü (dahil) ile bir önceki ayın 15'i (dahil) arası.
 * Örnek: Ekim 2026 → 15.09.2026 – 14.10.2026
 */
function getSalaryPeriodRange(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!m || m < 1 || m > 12 || !y) {
    throw new Error('Geçersiz ay/yıl');
  }

  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;

  // UTC gün başlangıcı ile saklanan DATE alanlarıyla tutarlı karşılaştırma
  const start = new Date(Date.UTC(prevYear, prevMonth - 1, 15));
  const endExclusive = new Date(Date.UTC(y, m - 1, 15)); // 14 dahil → 15 00:00 hariç

  return {
    month: m,
    year: y,
    start,
    endExclusive,
    startLabel: formatPeriodDay(15, prevMonth, prevYear),
    endLabel: formatPeriodDay(14, m, y),
  };
}

function getSalaryPeriodForDate(refDate = new Date()) {
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  if (Number.isNaN(d.getTime())) throw new Error('Geçersiz tarih');
  // Form, bitiş ayıyla anılır: 15 Eylül–14 Ekim → Ekim formu.
  // Ayın 1–14'ü bu ayın formundadır; 15'inden sonrası bir sonraki ayın formuna girer.
  const day = d.getDate();
  let month = d.getMonth() + 1;
  let year = d.getFullYear();
  if (day >= 15) {
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return getSalaryPeriodRange(month, year);
}

function formatPeriodDay(day, month, year) {
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function suggestNextDegreeRank(degree, rank) {
  const result = advanceDegreeRank(degree, rank);
  return { new_degree: result.degree, new_rank: result.rank };
}

module.exports = {
  getSalaryPeriodRange,
  getSalaryPeriodForDate,
  suggestNextDegreeRank,
};
