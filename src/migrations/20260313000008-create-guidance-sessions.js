'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GuidanceSessions', {
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
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      session_date: { type: Sequelize.DATEONLY, allowNull: false },
      session_type: { type: Sequelize.STRING, allowNull: false },
      summary: { type: Sequelize.TEXT, allowNull: false },
      referral_to: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('GuidanceSessions', ['tenant_id']);
    await queryInterface.addIndex('GuidanceSessions', ['student_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('GuidanceSessions');
  },
};
