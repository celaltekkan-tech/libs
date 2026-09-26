'use strict';

/** Platform yöneticisinin otomatik geri bildirim senkronunu açıp kapatması. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('FeedbackSyncStates', 'auto_sync_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('FeedbackSyncStates', 'auto_sync_enabled');
  },
};
