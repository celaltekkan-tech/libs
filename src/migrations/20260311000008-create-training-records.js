'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TrainingRecords', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      institution: { type: Sequelize.STRING, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      hours: { type: Sequelize.INTEGER, allowNull: true },
      certificate_no: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('TrainingRecords', ['tenant_id']);
    await queryInterface.addIndex('TrainingRecords', ['teacher_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TrainingRecords');
  },
};
