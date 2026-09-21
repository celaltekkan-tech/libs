'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Provinces', {
      id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      slug: { type: Sequelize.STRING(80), allowNull: true },
      region: { type: Sequelize.STRING(60), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('Districts', {
      id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
      province_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Provinces', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(80), allowNull: false },
      slug: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Districts', ['province_id']);
    await queryInterface.addIndex('Districts', ['province_id', 'name'], {
      unique: true,
      name: 'districts_province_name_unique',
    });

    await queryInterface.createTable('DirectorySchools', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      province_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Provinces', key: 'id' },
        onDelete: 'CASCADE',
      },
      district_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Districts', key: 'id' },
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(250), allowNull: false },
      school_type: {
        type: Sequelize.ENUM('ortaokul', 'lise'),
        allowNull: false,
      },
      website: { type: Sequelize.STRING(300), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DirectorySchools', ['province_id']);
    await queryInterface.addIndex('DirectorySchools', ['district_id']);
    await queryInterface.addIndex('DirectorySchools', ['school_type']);
    await queryInterface.addIndex('DirectorySchools', ['province_id', 'district_id', 'school_type'], {
      name: 'directory_schools_location_type_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DirectorySchools');
    await queryInterface.dropTable('Districts');
    await queryInterface.dropTable('Provinces');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DirectorySchools_school_type";');
  },
};
