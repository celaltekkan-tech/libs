'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Holidays', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      month: { type: Sequelize.INTEGER, allowNull: false },
      day: { type: Sequelize.INTEGER, allowNull: false },
      // null = her yıl tekrarlanan resmi tatil (ör. 1 Ocak); dolu = yalnızca o
      // yıla özel (ör. dini bayramlar gibi tarihi yıldan yıla değişenler).
      year: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Holidays', ['tenant_id']);
    await queryInterface.addIndex('Holidays', ['tenant_id', 'month', 'day', 'year'], {
      unique: true,
      name: 'holidays_tenant_month_day_year_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Holidays');
  },
};
