'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('WorkTasks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      assignee_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      frequency: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'once',
      },
      recurrence_config: { type: Sequelize.JSONB, allowNull: true },
      next_due_at: { type: Sequelize.DATE, allowNull: false },
      remind_before_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1440,
      },
      is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      notify_channels: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: Sequelize.literal("'[]'::jsonb"),
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      last_completed_at: { type: Sequelize.DATE, allowNull: true },
      last_reminder_at: { type: Sequelize.DATE, allowNull: true },
      last_overdue_notice_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('WorkTasks', ['tenant_id']);
    await queryInterface.addIndex('WorkTasks', ['assignee_user_id']);
    await queryInterface.addIndex('WorkTasks', ['status']);
    await queryInterface.addIndex('WorkTasks', ['next_due_at']);

    await queryInterface.createTable('WorkTaskNotificationLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'WorkTasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      channel: { type: Sequelize.STRING(20), allowNull: false },
      kind: { type: Sequelize.STRING(20), allowNull: false },
      occurrence_due_at: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false },
      error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('WorkTaskNotificationLogs', ['work_task_id']);
    await queryInterface.addIndex('WorkTaskNotificationLogs', [
      'work_task_id',
      'occurrence_due_at',
      'channel',
      'kind',
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WorkTaskNotificationLogs');
    await queryInterface.dropTable('WorkTasks');
  },
};
