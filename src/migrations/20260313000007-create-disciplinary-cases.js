'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DisciplinaryCases', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      incident_date: { type: Sequelize.DATEONLY, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      sanction_level: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'acik' },
      decision_date: { type: Sequelize.DATEONLY, allowNull: true },
      decision_summary: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DisciplinaryCases', ['tenant_id']);
    await queryInterface.addIndex('DisciplinaryCases', ['student_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('DisciplinaryCases');
  },
};
