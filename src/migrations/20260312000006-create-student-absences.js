'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StudentAbsences', {
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
      absence_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_excused: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reason: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('StudentAbsences', ['tenant_id']);
    await queryInterface.addIndex('StudentAbsences', ['student_id']);
    await queryInterface.addIndex('StudentAbsences', ['tenant_id', 'student_id', 'absence_date'], {
      unique: true,
      name: 'student_absences_student_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StudentAbsences');
  },
};
