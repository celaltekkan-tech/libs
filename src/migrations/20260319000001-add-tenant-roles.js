'use strict';

/** Nöbet yerlerine kat seviyesi sonrası: roller tenant'a özel olabilir. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('roles', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Tenants', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addColumn('roles', 'is_system', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('roles', 'description', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Mevcut (global) roller sistem rolü olarak işaretlenir
    await queryInterface.sequelize.query(`
      UPDATE roles SET is_system = true, description = COALESCE(description, role_name)
      WHERE tenant_id IS NULL
    `);

    // Sistem rolleri: role_name unique (tenant_id IS NULL)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS roles_system_name_unique
      ON roles (role_name) WHERE tenant_id IS NULL
    `);
    // Tenant özel rolleri: (tenant_id, role_name) unique
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_name_unique
      ON roles (tenant_id, role_name) WHERE tenant_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS roles_tenant_name_unique');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS roles_system_name_unique');
    await queryInterface.removeColumn('roles', 'description');
    await queryInterface.removeColumn('roles', 'is_system');
    await queryInterface.removeColumn('roles', 'tenant_id');
  },
};
