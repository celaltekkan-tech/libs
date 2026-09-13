'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Schools', 'school_type', {
      type: Sequelize.ENUM('ilkokul', 'ortaokul', 'lise'),
      allowNull: false,
      defaultValue: 'lise',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Schools', 'school_type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Schools_school_type";');
  },
};
