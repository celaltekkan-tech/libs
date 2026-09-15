'use strict';

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
  // Ayın 1–14 arası → bir önceki ayın formu; 15–son → bu ayın formu
  const day = d.getUTCDate ? d.getDate() : d.getDate();
  let month = d.getMonth() + 1;
  let year = d.getFullYear();
  if (day <= 14) {
    if (month === 1) {
      month = 12;
      year -= 1;
    } else {
      month -= 1;
    }
  }
  return getSalaryPeriodRange(month, year);
}

function formatPeriodDay(day, month, year) {
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function suggestNextDegreeRank(degree, rank) {
  const rankNum = Number(rank);
  if (Number.isFinite(rankNum)) {
    return {
      new_degree: degree != null && degree !== '' ? String(degree) : null,
      new_rank: String(rankNum + 1),
    };
  }
  return {
    new_degree: degree != null && degree !== '' ? String(degree) : null,
    new_rank: rank != null && rank !== '' ? String(rank) : null,
  };
}

module.exports = {
  getSalaryPeriodRange,
  getSalaryPeriodForDate,
  suggestNextDegreeRank,
};
