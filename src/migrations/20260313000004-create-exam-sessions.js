'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExamSessions', {
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
      name: { type: Sequelize.STRING, allowNull: false },
      exam_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ExamSessions', ['tenant_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ExamSessions');
  },
};
