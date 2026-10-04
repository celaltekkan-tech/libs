'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExamPeriods', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      academic_year_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'AcademicYears', key: 'id' },
        onDelete: 'CASCADE',
      },
      exam_type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'ortak' },
      label: { type: Sequelize.STRING, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ExamPeriods', ['tenant_id', 'academic_year_id', 'exam_type'], {
      name: 'exam_periods_tenant_year_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ExamPeriods');
  },
};
