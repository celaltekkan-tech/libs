'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Feedbacks', 'page_path', {
      type: Sequelize.STRING(300),
      allowNull: true,
    });
    await queryInterface.addColumn('Feedbacks', 'page_title', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Feedbacks', 'page_title');
    await queryInterface.removeColumn('Feedbacks', 'page_path');
  },
};
