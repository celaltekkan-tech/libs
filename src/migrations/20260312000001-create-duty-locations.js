'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DutyLocations', {
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
      name: { type: Sequelize.STRING, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DutyLocations', ['tenant_id']);
    await queryInterface.addIndex('DutyLocations', ['tenant_id', 'school_id', 'name'], {
      unique: true,
      name: 'duty_locations_tenant_school_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DutyLocations');
  },
};
