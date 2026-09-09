'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AttendanceRecords', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'CASCADE',
      },
      attendance_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false },
      overtime_hours: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('AttendanceRecords', ['tenant_id']);
    await queryInterface.addIndex('AttendanceRecords', ['teacher_id']);
    await queryInterface.addIndex('AttendanceRecords', ['tenant_id', 'teacher_id', 'attendance_date'], {
      unique: true,
      name: 'attendance_records_teacher_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AttendanceRecords');
  },
};
