'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'phone', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'phone');
  },
};
