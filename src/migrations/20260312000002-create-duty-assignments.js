'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DutyAssignments', {
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
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'CASCADE',
      },
      duty_location_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DutyLocations', key: 'id' },
        onDelete: 'CASCADE',
      },
      duty_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.STRING, allowNull: true },
      incident_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('DutyAssignments', ['tenant_id']);
    await queryInterface.addIndex('DutyAssignments', ['teacher_id']);
    await queryInterface.addIndex('DutyAssignments', ['duty_location_id']);
    await queryInterface.addIndex('DutyAssignments', ['tenant_id', 'teacher_id', 'duty_date'], {
      unique: true,
      name: 'duty_assignments_teacher_date_unique',
    });
    await queryInterface.addIndex('DutyAssignments', ['tenant_id', 'duty_location_id', 'duty_date'], {
      unique: true,
      name: 'duty_assignments_location_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DutyAssignments');
  },
};
