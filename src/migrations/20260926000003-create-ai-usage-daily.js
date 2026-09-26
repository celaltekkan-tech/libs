'use strict';

// Yapay zekâ eklentisinin kiracı başına günlük istek sayacı.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AiUsageDaily', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Europe/Istanbul takvim günü
      usage_date: { type: Sequelize.DATEONLY, allowNull: false },
      used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('AiUsageDaily', ['tenant_id', 'usage_date'], {
      unique: true,
      name: 'ai_usage_daily_tenant_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AiUsageDaily');
  },
};
