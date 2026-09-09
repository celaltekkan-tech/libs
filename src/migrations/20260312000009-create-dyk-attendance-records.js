'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DykAttendanceRecords', {
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
      session_date: { type: Sequelize.DATEONLY, allowNull: false },
      present: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DykAttendanceRecords', ['tenant_id']);
    await queryInterface.addIndex('DykAttendanceRecords', ['dyk_course_id']);
    await queryInterface.addIndex('DykAttendanceRecords', ['dyk_course_id', 'student_id', 'session_date'], {
      unique: true,
      name: 'dyk_attendance_course_student_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DykAttendanceRecords');
  },
};
