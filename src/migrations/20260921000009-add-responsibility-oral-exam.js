'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ResponsibilityExamItems', 'oral_exam_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('ResponsibilityExamItems', 'oral_start_time', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ResponsibilityExamItems', 'oral_start_time');
    await queryInterface.removeColumn('ResponsibilityExamItems', 'oral_exam_date');
  },
};
