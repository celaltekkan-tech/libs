'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Classrooms', {
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
        onDelete: 'SET NULL',
      },
      class_level: { type: Sequelize.STRING, allowNull: false },
      section: { type: Sequelize.STRING, allowNull: false },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'SET NULL',
      },
      academic_year: { type: Sequelize.STRING, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Classrooms', ['tenant_id']);
    await queryInterface.addIndex('Classrooms', ['school_id']);
    await queryInterface.addIndex('Classrooms', ['teacher_id']);
    await queryInterface.addIndex('Classrooms', ['tenant_id', 'school_id', 'class_level', 'section', 'academic_year'], {
      unique: true,
      name: 'classrooms_tenant_school_level_section_year_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Classrooms');
  },
};
