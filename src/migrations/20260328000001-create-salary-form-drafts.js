'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SalaryFormDrafts', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      month: { type: Sequelize.INTEGER, allowNull: false },
      year: { type: Sequelize.INTEGER, allowNull: false },
      // Excel'de DB'de olmayan / elle girilen tüm alanlar
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('SalaryFormDrafts', ['tenant_id', 'year', 'month'], {
      unique: true,
      name: 'salary_form_drafts_tenant_period_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SalaryFormDrafts');
  },
};
