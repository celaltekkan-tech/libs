'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AuditLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      user_email: { type: Sequelize.STRING, allowNull: true },
      user_name: { type: Sequelize.STRING, allowNull: true },
      action: { type: Sequelize.STRING, allowNull: false },
      entity_type: { type: Sequelize.STRING, allowNull: false },
      entity_id: { type: Sequelize.INTEGER, allowNull: true },
      summary: { type: Sequelize.STRING, allowNull: false },
      meta: { type: Sequelize.JSONB, allowNull: true },
      ip: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('AuditLogs', ['tenant_id']);
    await queryInterface.addIndex('AuditLogs', ['user_id']);
    await queryInterface.addIndex('AuditLogs', ['entity_type']);
    await queryInterface.addIndex('AuditLogs', ['created_at']);
    await queryInterface.addIndex('AuditLogs', ['tenant_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AuditLogs');
  },
};
