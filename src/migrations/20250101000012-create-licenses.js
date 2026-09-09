'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Licenses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      plan: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      starts_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      ends_at: { type: Sequelize.DATE, allowNull: true },
      cancelled_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Licenses', ['tenant_id']);
    await queryInterface.addIndex('Licenses', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Licenses');
  },
};
