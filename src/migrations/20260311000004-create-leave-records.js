'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaveRecords', {
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
      leave_type: { type: Sequelize.STRING, allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      day_count: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('LeaveRecords', ['tenant_id']);
    await queryInterface.addIndex('LeaveRecords', ['teacher_id']);
    await queryInterface.addIndex('LeaveRecords', ['leave_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaveRecords');
  },
};
