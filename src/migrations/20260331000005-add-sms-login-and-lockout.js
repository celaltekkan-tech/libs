'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tenants', 'sms_login_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('Users', 'sms_login_code_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'sms_login_code_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'sms_login_requests_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'sms_login_requests_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Users', 'login_failed_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Users', 'login_locked_until', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'login_locked_until');
    await queryInterface.removeColumn('Users', 'login_failed_count');
    await queryInterface.removeColumn('Users', 'sms_login_requests_count');
    await queryInterface.removeColumn('Users', 'sms_login_requests_date');
    await queryInterface.removeColumn('Users', 'sms_login_code_expires_at');
    await queryInterface.removeColumn('Users', 'sms_login_code_hash');
    await queryInterface.removeColumn('Tenants', 'sms_login_enabled');
  },
};
