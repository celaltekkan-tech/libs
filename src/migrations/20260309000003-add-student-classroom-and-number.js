'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Students', 'classroom_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Classrooms', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('Students', 'student_number', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex('Students', ['classroom_id']);
    await queryInterface.addIndex('Students', ['tenant_id', 'student_number'], {
      unique: true,
      name: 'students_tenant_student_number_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Students', 'students_tenant_student_number_unique');
    await queryInterface.removeIndex('Students', ['classroom_id']);
    await queryInterface.removeColumn('Students', 'student_number');
    await queryInterface.removeColumn('Students', 'classroom_id');
  },
};
