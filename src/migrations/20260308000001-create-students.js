'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Students', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      school_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Schools', key: 'id' },
        onDelete: 'SET NULL',
      },
      national_id: { type: Sequelize.STRING },
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      class_level: { type: Sequelize.STRING },
      section: { type: Sequelize.STRING },
      gender: { type: Sequelize.STRING(1) },
      birth_date: { type: Sequelize.DATEONLY },
      registration_status: { type: Sequelize.STRING, defaultValue: 'aktif' },
      parent_name: { type: Sequelize.STRING },
      parent_phone: { type: Sequelize.STRING },
      is_inclusion: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_foreign: { type: Sequelize.BOOLEAN, defaultValue: false },
      meta: { type: Sequelize.JSONB },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Students', ['tenant_id']);
    await queryInterface.addIndex('Students', ['school_id']);
    // PostgreSQL'de NULL değerler unique index'te çakışmaz; boş T.C. tekrarlanabilir.
    await queryInterface.addIndex('Students', ['tenant_id', 'national_id'], {
      unique: true,
      name: 'students_tenant_national_id_unique',
    });
    await queryInterface.addIndex('Students', ['class_level']);
    await queryInterface.addIndex('Students', ['section']);
    await queryInterface.addIndex('Students', ['registration_status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Students');
  },
};
