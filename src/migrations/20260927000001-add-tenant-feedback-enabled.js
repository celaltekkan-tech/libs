'use strict';

/** Geri bildirim modülü varsayılan kapalıdır; platform yöneticisi hesap bazında açar. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tenants', 'feedback_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Tenants', 'feedback_enabled');
  },
};
