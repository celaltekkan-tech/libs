'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ExamRooms', 'building', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('ExamRooms', 'floor', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('ExamRooms', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('ExamRooms', 'seating_layout', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ExamRooms', 'building');
    await queryInterface.removeColumn('ExamRooms', 'floor');
    await queryInterface.removeColumn('ExamRooms', 'is_active');
    await queryInterface.removeColumn('ExamRooms', 'seating_layout');
  },
};
