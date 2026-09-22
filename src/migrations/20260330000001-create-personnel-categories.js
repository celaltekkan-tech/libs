'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PersonnelCategories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      code: { type: Sequelize.STRING, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('PersonnelCategories', ['tenant_id']);
    await queryInterface.addIndex('PersonnelCategories', ['tenant_id', 'name'], {
      unique: true,
      name: 'personnel_categories_tenant_name_unique',
    });

    await queryInterface.addColumn('Teachers', 'personnel_category_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'PersonnelCategories', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('Teachers', ['personnel_category_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Teachers', ['personnel_category_id']);
    await queryInterface.removeColumn('Teachers', 'personnel_category_id');
    await queryInterface.dropTable('PersonnelCategories');
  },
};
