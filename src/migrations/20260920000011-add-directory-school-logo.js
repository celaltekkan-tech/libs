'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('DirectorySchools', 'logo_path', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('DirectorySchools', 'logo_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('DirectorySchools', 'logo_checked_at');
    await queryInterface.removeColumn('DirectorySchools', 'logo_path');
  },
};
