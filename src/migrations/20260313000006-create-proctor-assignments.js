'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProctorAssignments', {
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
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ProctorAssignments', ['tenant_id']);
    await queryInterface.addIndex('ProctorAssignments', ['exam_room_id', 'teacher_id'], {
      unique: true,
      name: 'proctor_assignments_room_teacher_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ProctorAssignments');
  },
};
