'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ResponsibilityExamItems', {
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
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Students', key: 'id' },
        onDelete: 'SET NULL',
      },
      classroom_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Classrooms', key: 'id' },
        onDelete: 'SET NULL',
      },
      student_number: { type: Sequelize.STRING, allowNull: false },
      student_name: { type: Sequelize.STRING, allowNull: false },
      current_class_level: { type: Sequelize.STRING, allowNull: true },
      current_section: { type: Sequelize.STRING, allowNull: true },
      subject_class_level: { type: Sequelize.STRING, allowNull: false },
      subject_name: { type: Sequelize.STRING, allowNull: false },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Subjects', key: 'id' },
        onDelete: 'SET NULL',
      },
      exam_date: { type: Sequelize.DATEONLY, allowNull: true },
      start_time: { type: Sequelize.STRING, allowNull: true },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: true },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'SET NULL',
      },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ResponsibilityExamItems', ['tenant_id']);
    await queryInterface.addIndex('ResponsibilityExamItems', ['tenant_id', 'exam_date']);
    await queryInterface.addIndex('ResponsibilityExamItems', ['tenant_id', 'student_number', 'subject_class_level', 'subject_name'], {
      unique: true,
      name: 'responsibility_exam_items_unique_student_subject',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ResponsibilityExamItems');
  },
};
