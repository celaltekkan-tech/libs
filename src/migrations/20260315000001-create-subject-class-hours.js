'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SubjectClassHours', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' },
        onDelete: 'CASCADE',
      },
      class_level: { type: Sequelize.STRING, allowNull: false },
      weekly_hours: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('SubjectClassHours', ['tenant_id']);
    await queryInterface.addIndex('SubjectClassHours', ['subject_id']);
    await queryInterface.addIndex('SubjectClassHours', ['tenant_id', 'subject_id', 'class_level'], {
      unique: true,
      name: 'subject_class_hours_tenant_subject_level_unique',
    });

    // Tek bir genel varsayılan saatti; sınıf seviyesine göre değişen gerçek
    // haftalık ders çizelgesi ihtiyacını karşılamıyordu.
    await queryInterface.removeColumn('Subjects', 'weekly_hours_default');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Subjects', 'weekly_hours_default', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.dropTable('SubjectClassHours');
  },
};
