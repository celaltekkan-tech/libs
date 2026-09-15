'use strict';

/**
 * Kademe / Terfi Formu — hücre eşlemesi
 *
 * Şablon dosyasına DOKUNULMAZ. Yalnızca burada tanımlı hücreler doldurulur.
 * Bir alanı doldurmak istemiyorsanız değeri `null` yapın.
 *
 * Kullanılabilir alanlar:
 *   promotion_date, city, district,
 *   personnel_no, national_id, full_name, last_graduated_school,
 *   class_level, title_branch, working_institution,
 *   previous_degree, pension_degree, previous_rank, previous_degree_rank_date,
 *   new_degree, pension_degree_new, new_rank, new_degree_rank_date,
 *   note, school_principal
 */
module.exports = {
  cells: {
    promotion_date: 'G1',
    city: 'B3',
    district: 'E3',

    personnel_no: 'A14',
    national_id: 'B14',
    full_name: 'C14',
    last_graduated_school: 'D14',
    class_level: 'E14',
    title_branch: 'F14',
    working_institution: 'G14',

    previous_degree: 'H14',
    pension_degree: 'I14',
    previous_rank: 'J14',
    previous_degree_rank_date: 'K14',

    new_degree: 'L14',
    pension_degree_new: 'M14',
    new_rank: 'N14',
    new_degree_rank_date: 'O14',

    note: 'P14',
    school_principal: 'M18',
  },
};
