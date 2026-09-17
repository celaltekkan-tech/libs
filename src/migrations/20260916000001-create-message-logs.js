'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MessageLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      channel: { type: Sequelize.STRING(10), allowNull: false },
      source_module: { type: Sequelize.STRING(30), allowNull: false },
      source_id: { type: Sequelize.INTEGER, allowNull: true },
      recipient_label: { type: Sequelize.STRING(150), allowNull: true },
      recipient_contact: { type: Sequelize.STRING(150), allowNull: true },
      subject: { type: Sequelize.STRING(300), allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false },
      error: { type: Sequelize.TEXT, allowNull: true },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('MessageLogs', ['tenant_id', 'created_at']);
    await queryInterface.addIndex('MessageLogs', ['channel']);

    await queryInterface.createTable('MessageLogHides', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      message_log_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'MessageLogs', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('MessageLogHides', ['message_log_id', 'user_id'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MessageLogHides');
    await queryInterface.dropTable('MessageLogs');
  },
};
