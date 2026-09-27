'use strict';

// Seçmeli dersler: bir şubenin öğrencileri farklı seçmelilere bölünebilir.
// - TimetableAssignments.elective_group: aynı gruptaki seçmeliler birbirinin alternatifidir
//   (öğrenci birini alır), aynı saatte paralel işlenebilir.
// - TimetableElectiveChoices: öğrencinin hangi seçmeliyi aldığı; varsa çakışma öğrenci bazında denetlenir.
// - ScheduleEntries: aynı şube aynı saatte farklı derslerde olabilir (paralel seçmeli).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TimetableAssignments', 'elective_group', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });

    await queryInterface.createTable('TimetableElectiveChoices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'TimetableProjects', key: 'id' },
        onDelete: 'CASCADE',
      },
      assignment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'TimetableAssignments', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('TimetableElectiveChoices', ['assignment_id', 'student_id'], {
      unique: true,
      name: 'timetable_elective_choices_unique',
    });
    await queryInterface.addIndex('TimetableElectiveChoices', ['project_id']);

    await queryInterface.removeIndex('ScheduleEntries', 'schedule_entries_classroom_slot_unique');
    await queryInterface.addIndex(
      'ScheduleEntries',
      ['tenant_id', 'classroom_id', 'day_of_week', 'period_no', 'academic_year', 'subject_id'],
      { unique: true, name: 'schedule_entries_classroom_slot_subject_unique' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ScheduleEntries', 'schedule_entries_classroom_slot_subject_unique');
    await queryInterface.addIndex(
      'ScheduleEntries',
      ['tenant_id', 'classroom_id', 'day_of_week', 'period_no', 'academic_year'],
      { unique: true, name: 'schedule_entries_classroom_slot_unique' }
    );
    await queryInterface.dropTable('TimetableElectiveChoices');
    await queryInterface.removeColumn('TimetableAssignments', 'elective_group');
  },
};
