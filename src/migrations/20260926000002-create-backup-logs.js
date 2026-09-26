'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BackupLogs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      action: { type: Sequelize.STRING(20), allowNull: false },
      trigger: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'system' },
      status: { type: Sequelize.STRING(20), allowNull: false },
      filename: { type: Sequelize.STRING(255), allowNull: true },
      size_bytes: { type: Sequelize.BIGINT, allowNull: true },
      duration_ms: { type: Sequelize.INTEGER, allowNull: true },
      backup_dir: { type: Sequelize.STRING(500), allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      // Geri yükleme Users tablosunu da değiştirebildiği için FK yok; e-posta ayrıca saklanır.
      user_id: { type: Sequelize.INTEGER, allowNull: true },
      user_label: { type: Sequelize.STRING(255), allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('BackupLogs', ['created_at']);
    await queryInterface.addIndex('BackupLogs', ['filename']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('BackupLogs');
  },
};
