'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('Users', 'last_login_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('Users', ['tenant_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', ['tenant_id']);
    await queryInterface.removeColumn('Users', 'last_login_at');
    await queryInterface.removeColumn('Users', 'is_active');
  },
};
