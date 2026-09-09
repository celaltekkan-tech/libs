'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Exams', {
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
      classroom_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Classrooms', key: 'id' },
        onDelete: 'CASCADE',
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' },
        onDelete: 'RESTRICT',
      },
      exam_type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'yazili' },
      exam_date: { type: Sequelize.DATEONLY, allowNull: false },
      start_time: { type: Sequelize.STRING, allowNull: true },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: true },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('Exams', ['tenant_id']);
    await queryInterface.addIndex('Exams', ['classroom_id']);
    await queryInterface.addIndex('Exams', ['tenant_id', 'classroom_id', 'exam_date'], {
      unique: true,
      name: 'exams_classroom_date_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Exams');
  },
};
