'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'birth_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "Teachers"
      SET birth_date = (meta->>'dogum_tarihi')::date
      WHERE birth_date IS NULL
        AND meta IS NOT NULL
        AND COALESCE(meta->>'dogum_tarihi', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'birth_date');
  },
};
