'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Feedbacks', 'reply', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('Feedbacks', 'replied_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Feedbacks', 'reply');
    await queryInterface.removeColumn('Feedbacks', 'replied_at');
  },
};
