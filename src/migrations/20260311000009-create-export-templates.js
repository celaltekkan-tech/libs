'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExportTemplates', {
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
      entity_type: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      columns: { type: Sequelize.JSONB, allowNull: false },
      filters: { type: Sequelize.JSONB, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ExportTemplates', ['tenant_id', 'entity_type']);
    await queryInterface.addIndex('ExportTemplates', ['tenant_id', 'entity_type', 'name'], {
      unique: true,
      name: 'export_templates_tenant_entity_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ExportTemplates');
  },
};
