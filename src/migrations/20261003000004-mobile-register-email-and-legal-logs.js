'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const requests = await queryInterface.describeTable('MobileRegisterRequests');
    if (!requests.email) {
      await queryInterface.addColumn('MobileRegisterRequests', 'email', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    await queryInterface.createTable('LegalTimestampLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Schools', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'MobileRegisterRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      event_type: { type: Sequelize.STRING(80), allowNull: false },
      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      actor_name: { type: Sequelize.STRING(120), allowNull: true },
      actor_email: { type: Sequelize.STRING, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false },
      canonical_json: { type: Sequelize.TEXT, allowNull: false },
      content_hash: { type: Sequelize.STRING(64), allowNull: false },
      hash_algorithm: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'SHA-256' },
      timestamp_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      timestamp_token: { type: Sequelize.TEXT, allowNull: true },
      timestamped_at: { type: Sequelize.DATE, allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      user_agent: { type: Sequelize.STRING(400), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('LegalTimestampLogs', ['tenant_id', 'event_type', 'created_at'], {
      name: 'legal_timestamp_logs_tenant_event_created',
    });
    await queryInterface.addIndex('LegalTimestampLogs', ['content_hash'], {
      name: 'legal_timestamp_logs_content_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LegalTimestampLogs');
    const requests = await queryInterface.describeTable('MobileRegisterRequests');
    if (requests.email) {
      await queryInterface.removeColumn('MobileRegisterRequests', 'email');
    }
  },
};
