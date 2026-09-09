'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AcademicYears', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      label: { type: Sequelize.STRING, allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('AcademicYears', ['tenant_id']);
    await queryInterface.addIndex('AcademicYears', ['tenant_id', 'label'], {
      unique: true,
      name: 'academic_years_tenant_label_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AcademicYears');
  },
};
