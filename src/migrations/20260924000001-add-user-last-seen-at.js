'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('Users', ['last_seen_at']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', ['last_seen_at']);
    await queryInterface.removeColumn('Users', 'last_seen_at');
  },
};
