'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'first_duty_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE "Teachers"
      SET first_duty_date = (meta->>'ilk_gorev_tarihi')::date
      WHERE first_duty_date IS NULL
        AND meta->>'ilk_gorev_tarihi' IS NOT NULL
        AND meta->>'ilk_gorev_tarihi' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'first_duty_date');
  },
};
