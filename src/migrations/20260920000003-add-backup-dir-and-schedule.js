'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('BackupSettings', 'backup_dir', {
      type: Sequelize.STRING(500),
      allowNull: false,
      defaultValue: 'backups',
    });
    await queryInterface.addColumn('BackupSettings', 'schedule_time', {
      type: Sequelize.STRING(5),
      allowNull: false,
      defaultValue: '03:30',
    });
    await queryInterface.addColumn('BackupSettings', 'last_run_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('BackupSettings', 'last_run_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('BackupSettings', 'last_run_message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('BackupSettings', 'last_run_message');
    await queryInterface.removeColumn('BackupSettings', 'last_run_status');
    await queryInterface.removeColumn('BackupSettings', 'last_run_at');
    await queryInterface.removeColumn('BackupSettings', 'schedule_time');
    await queryInterface.removeColumn('BackupSettings', 'backup_dir');
  },
};
