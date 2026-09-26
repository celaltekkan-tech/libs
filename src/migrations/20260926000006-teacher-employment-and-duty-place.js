'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const teacherTable = await queryInterface.describeTable('Teachers');
    if (!teacherTable.employment_type) {
      await queryInterface.addColumn('Teachers', 'employment_type', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    if (!teacherTable.typ_subject) {
      await queryInterface.addColumn('Teachers', 'typ_subject', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('DutyAssignments');
    const locationDate = indexes.find((index) => index.name === 'duty_assignments_location_date_unique');
    if (locationDate) {
      await queryInterface.removeIndex('DutyAssignments', 'duty_assignments_location_date_unique');
    }
  },

  async down(queryInterface) {
    await queryInterface.addIndex('DutyAssignments', ['duty_location_id', 'duty_date'], {
      unique: true,
      name: 'duty_assignments_location_date_unique',
    });
    await queryInterface.removeColumn('Teachers', 'typ_subject');
    await queryInterface.removeColumn('Teachers', 'employment_type');
  },
};
