'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('DirectorySchools', 'code', {
      type: Sequelize.STRING(6),
      allowNull: true,
    });
    await queryInterface.addIndex('DirectorySchools', ['code'], {
      name: 'directory_schools_code_idx',
    });

    await queryInterface.addColumn('Schools', 'province_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Provinces', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('Schools', 'district_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Districts', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('Schools', 'directory_school_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'DirectorySchools', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('Schools', ['province_id']);
    await queryInterface.addIndex('Schools', ['district_id']);
    await queryInterface.addIndex('Schools', ['directory_school_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Schools', 'directory_school_id');
    await queryInterface.removeColumn('Schools', 'district_id');
    await queryInterface.removeColumn('Schools', 'province_id');
    await queryInterface.removeIndex('DirectorySchools', 'directory_schools_code_idx');
    await queryInterface.removeColumn('DirectorySchools', 'code');
  },
};
