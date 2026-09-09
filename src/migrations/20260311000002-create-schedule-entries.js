'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ScheduleEntries', {
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
      classroom_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Classrooms', key: 'id' },
        onDelete: 'CASCADE',
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' },
        onDelete: 'RESTRICT',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'SET NULL',
      },
      // 1=Pazartesi ... 6=Cumartesi
      day_of_week: { type: Sequelize.INTEGER, allowNull: false },
      // Günün kaçıncı ders saati (1..N)
      period_no: { type: Sequelize.INTEGER, allowNull: false },
      academic_year: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ScheduleEntries', ['tenant_id']);
    await queryInterface.addIndex('ScheduleEntries', ['classroom_id']);
    await queryInterface.addIndex('ScheduleEntries', ['teacher_id']);
    await queryInterface.addIndex('ScheduleEntries', ['subject_id']);

    // Aynı sınıf, aynı gün ve saatte yalnızca tek ders olabilir.
    await queryInterface.addIndex(
      'ScheduleEntries',
      ['tenant_id', 'classroom_id', 'day_of_week', 'period_no', 'academic_year'],
      { unique: true, name: 'schedule_entries_classroom_slot_unique' }
    );

    // Aynı öğretmen, aynı gün ve saatte yalnızca tek sınıfta ders verebilir
    // (teacher_id NULL olan kayıtlar bu kısıtın dışındadır).
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX schedule_entries_teacher_slot_unique
      ON "ScheduleEntries" (tenant_id, teacher_id, day_of_week, period_no, academic_year)
      WHERE teacher_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ScheduleEntries');
  },
};
