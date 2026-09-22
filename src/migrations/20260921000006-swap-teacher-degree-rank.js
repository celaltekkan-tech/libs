'use strict';

// MEBBİS durum satırı "Görevde {derece}-{kademe}" biçimindedir.
// Eski içe aktarma ilk sayıyı kademe, ikinci sayıyı derece yazdığı için
// Teachers.degree ile Teachers.rank (ve varsa terfi geçmişi) yer değiştirmişti.

async function swapColumns(queryInterface, table, left, right) {
  await queryInterface.sequelize.query(
    `UPDATE "${table}"
     SET "${left}" = "${right}", "${right}" = "${left}"
     WHERE "${left}" IS NOT NULL AND "${right}" IS NOT NULL`,
  );
}

module.exports = {
  async up(queryInterface) {
    await swapColumns(queryInterface, 'Teachers', 'degree', 'rank');
    await swapColumns(queryInterface, 'PromotionHistories', 'previous_degree', 'previous_rank');
    await swapColumns(queryInterface, 'PromotionHistories', 'new_degree', 'new_rank');
  },

  async down(queryInterface) {
    await swapColumns(queryInterface, 'Teachers', 'degree', 'rank');
    await swapColumns(queryInterface, 'PromotionHistories', 'previous_degree', 'previous_rank');
    await swapColumns(queryInterface, 'PromotionHistories', 'new_degree', 'new_rank');
  },
};
