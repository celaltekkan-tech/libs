'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SeatAssignments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      exam_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ExamSessions', key: 'id' },
        onDelete: 'CASCADE',
      },
      exam_room_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ExamRooms', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      seat_no: { type: Sequelize.INTEGER, allowNull: false },
      classroom_label: { type: Sequelize.STRING, allowNull: true },
      present: { type: Sequelize.BOOLEAN, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('SeatAssignments', ['tenant_id']);
    await queryInterface.addIndex('SeatAssignments', ['exam_session_id']);
    await queryInterface.addIndex('SeatAssignments', ['exam_room_id', 'seat_no'], {
      unique: true,
      name: 'seat_assignments_room_seat_unique',
    });
    await queryInterface.addIndex('SeatAssignments', ['exam_session_id', 'student_id'], {
      unique: true,
      name: 'seat_assignments_session_student_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SeatAssignments');
  },
};
