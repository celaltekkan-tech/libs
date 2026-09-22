'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TeacherNotes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      school_id: { type: Sequelize.INTEGER, allowNull: true },
      student_id: { type: Sequelize.INTEGER, allowNull: false },
      teacher_id: { type: Sequelize.INTEGER, allowNull: false },
      tags: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('TeacherNotes', ['tenant_id']);
    await queryInterface.addIndex('TeacherNotes', ['student_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TeacherNotes');
  },
};
