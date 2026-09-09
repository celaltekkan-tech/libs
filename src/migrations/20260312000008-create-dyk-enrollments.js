'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DykEnrollments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      dyk_course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DykCourses', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DykEnrollments', ['tenant_id']);
    await queryInterface.addIndex('DykEnrollments', ['dyk_course_id', 'student_id'], {
      unique: true,
      name: 'dyk_enrollments_course_student_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DykEnrollments');
  },
};
