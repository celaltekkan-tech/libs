'use strict';

function upperTr(value) {
  if (value == null) return value;
  return String(value).toLocaleUpperCase('tr-TR');
}

/** Kayıtlı öğretmen ve personel adlarını Türkçe büyük harfe çeker. Eski yazım geri alınamaz. */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, first_name, last_name FROM "Teachers"',
    );
    for (const row of rows) {
      const first = upperTr(row.first_name);
      const last = upperTr(row.last_name);
      if (first === row.first_name && last === row.last_name) continue;
      await queryInterface.sequelize.query(
        'UPDATE "Teachers" SET first_name = :first, last_name = :last WHERE id = :id',
        { replacements: { first, last, id: row.id } },
      );
    }
  },

  async down() {},
};
