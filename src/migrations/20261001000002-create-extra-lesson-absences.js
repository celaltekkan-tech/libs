'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExtraLessonAbsences', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      absence_date: { type: Sequelize.DATEONLY, allowNull: false },
      reason: { type: Sequelize.STRING(30), allowNull: false },
      note: { type: Sequelize.STRING(300), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ExtraLessonAbsences', ['tenant_id', 'teacher_id', 'absence_date'], {
      unique: true,
      name: 'extra_lesson_absences_teacher_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ExtraLessonAbsences');
  },
};
