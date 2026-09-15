'use strict';

/**
 * Maaş Değişikliği Bildirim Formu — hücre eşlemesi
 *
 * Şablon dosyasına DOKUNULMAZ. Yalnızca burada tanımlı hücreler doldurulur.
 * Bir alanı doldurmak istemiyorsanız değeri `null` yapın.
 *
 * Header alanları (draft + otomatik):
 *   institution_name, bank_branch, month_name, year, accounting_code,
 *   previous_month, started, left, payable, form_date, principal
 *
 * Satır bölümleri draft'tan gelir; terfi satırları DB PromotionHistory'den gelir.
 */
module.exports = {
  header: {
    institution_name: 'C3',
    bank_branch: 'C4',
    month_name: 'I3',
    year: 'J3',
    accounting_code: 'J5',
    previous_month: 'C6',
    started: 'E6',
    left: 'G6',
    payable: 'I6',
    form_date: 'I77',
    principal: 'I79',
  },

  // B) Ayrılan personel
  departureRows: {
    startRow: 10,
    endRow: 14,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      leave_date: 'E',
      leave_reason: 'G',
      documents: 'I',
    },
  },

  // C) Başlayan personel
  starterRows: {
    startRow: 18,
    endRow: 24,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      iban: 'E',
      start_reason: 'G',
      start_date: 'H',
      documents: 'I',
    },
  },

  // D) Terfi (DB)
  promotionRows: {
    startRow: 28,
    endRow: 36,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      previous_degree: 'E',
      previous_rank: 'F',
      new_degree: 'G',
      new_rank: 'H',
      promotion_date: 'I',
      documents: 'J',
    },
  },

  // E) Diğer maaş değişiklikleri
  otherChangeRows: {
    startRow: 40,
    endRow: 47,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      previous_status: 'E',
      new_status: 'G',
      documents: 'I',
    },
  },

  // F) Kesintiler
  deductionRows: {
    startRow: 58,
    endRow: 60,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      reason: 'E',
      amount: 'G',
      documents: 'I',
    },
  },

  // G) Raporlu gün
  reportDayRows: {
    startRow: 65,
    endRow: 70,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      start_date: 'E',
      days_after_7: 'G',
      documents: 'I',
    },
  },

  // H) Sendika değişikliği
  unionChangeRows: {
    startRow: 74,
    endRow: 76,
    columns: {
      personnel_no: 'A',
      full_name: 'B',
      national_id: 'D',
      left_union: 'E',
      joined_union: 'G',
      documents: 'I',
    },
  },
};
