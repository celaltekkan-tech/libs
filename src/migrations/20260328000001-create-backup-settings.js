'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BackupSettings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      retention_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('BackupSettings');
  },
};
