'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Students"
      SET boarding_status = 'Gündüzlü',
          updated_at = NOW()
      WHERE boarding_status IS NULL
         OR BTRIM(boarding_status) = ''
    `);
  },

  async down(queryInterface) {
    // Geri alınamaz: önceki boş/null değerler ayırt edilemez.
    await queryInterface.sequelize.query('SELECT 1');
  },
};
