'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Feedbacks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      message: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'new' },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Feedbacks', ['tenant_id']);
    await queryInterface.addIndex('Feedbacks', ['user_id']);
    await queryInterface.addIndex('Feedbacks', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Feedbacks');
  },
};
