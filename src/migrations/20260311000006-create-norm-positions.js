'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('NormPositions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Schools', key: 'id' },
        onDelete: 'CASCADE',
      },
      title_branch: { type: Sequelize.STRING, allowNull: false },
      quota_count: { type: Sequelize.INTEGER, allowNull: false },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('NormPositions', ['tenant_id']);
    await queryInterface.addIndex('NormPositions', ['school_id']);
    await queryInterface.addIndex('NormPositions', ['tenant_id', 'school_id', 'title_branch'], {
      unique: true,
      name: 'norm_positions_tenant_school_branch_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('NormPositions');
  },
};
