'use strict';

const { backfillSubjectsFromTeachers } = require('../services/subjectFromBranchService');

module.exports = {
  async up() {
    const result = await backfillSubjectsFromTeachers();
    console.log(
      `Öğretmen branşlarından ders: ${result.tenantCount} hesap, ${result.createdCount} yeni ders`,
    );
  },

  async down() {
    // Kullanıcı tanımlı derslerle karışmasın diye geri alınmaz.
  },
};
