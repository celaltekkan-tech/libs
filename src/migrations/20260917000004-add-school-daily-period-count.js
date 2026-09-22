'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Schools', 'daily_period_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 8,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Schools', 'daily_period_count');
  },
};
