'use strict';

// Otomatik ders programı (OR-Tools) çalışma tabloları. Yayınlanan program
// mevcut ScheduleEntries tablosuna yazılır; buradaki tablolar taslak içindir.
module.exports = {
  async up(queryInterface, Sequelize) {
    const ts = {
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    };
    const tenant = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'Tenants', key: 'id' },
      onDelete: 'CASCADE',
    };
    const project = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'TimetableProjects', key: 'id' },
      onDelete: 'CASCADE',
    };

    await queryInterface.createTable('TimetableProjects', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Schools', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      academic_year: { type: Sequelize.STRING, allowNull: true },
      // Kullanılan günler (1=Pazartesi .. 6=Cumartesi)
      days: { type: Sequelize.JSONB, allowNull: false, defaultValue: [1, 2, 3, 4, 5] },
      periods_per_day: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8 },
      // Bu saatten sonra öğle arası; blok dersler arayı aşamaz.
      lunch_after: { type: Sequelize.INTEGER, allowNull: true },
      // weights, time_limit, max_subject_daily
      settings: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'taslak' },
      published_at: { type: Sequelize.DATE, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('TimetableProjects', ['tenant_id', 'school_id']);

    await queryInterface.createTable('TimetableRooms', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Schools', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      room_type: { type: Sequelize.STRING, allowNull: true },
      // Aynı saatte kaç şubenin kullanabileceği (spor salonu 2 gibi)
      capacity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('TimetableRooms', ['tenant_id', 'school_id']);

    await queryInterface.createTable('TimetableAssignments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      project_id: project,
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
        onDelete: 'CASCADE',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'SET NULL',
      },
      weekly_hours: { type: Sequelize.INTEGER, allowNull: false },
      // "2+2+1" gibi; boşsa 2'li bloklar + artan 1 saat
      block_pattern: { type: Sequelize.STRING, allowNull: true },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'TimetableRooms', key: 'id' },
        onDelete: 'SET NULL',
      },
      // Aynı gruptaki dersler aynı saatlere yerleşir (seçmeli / birleşik ders)
      sync_group: { type: Sequelize.STRING, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('TimetableAssignments', ['project_id']);

    await queryInterface.createTable('TimetableConstraints', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      project_id: project,
      type: { type: Sequelize.STRING, allowNull: false },
      is_hard: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      weight: { type: Sequelize.INTEGER, allowNull: true },
      params: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      // manuel | ai
      source: { type: Sequelize.STRING, allowNull: false, defaultValue: 'manuel' },
      source_text: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('TimetableConstraints', ['project_id']);

    await queryInterface.createTable('TimetableRuns', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      project_id: project,
      // kuyrukta | calisiyor | tamamlandi | basarisiz | iptal
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'kuyrukta' },
      job_id: { type: Sequelize.STRING, allowNull: true },
      time_limit: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 60 },
      solver_status: { type: Sequelize.STRING, allowNull: true },
      objective: { type: Sequelize.FLOAT, allowNull: true },
      best_bound: { type: Sequelize.FLOAT, allowNull: true },
      progress: { type: Sequelize.JSONB, allowNull: true },
      // lessons, score, violations
      result: { type: Sequelize.JSONB, allowNull: true },
      diagnostics: { type: Sequelize.JSONB, allowNull: true },
      error: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      applied_at: { type: Sequelize.DATE, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('TimetableRuns', ['project_id']);

    await queryInterface.createTable('TimetableLessons', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: tenant,
      project_id: project,
      assignment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'TimetableAssignments', key: 'id' },
        onDelete: 'CASCADE',
      },
      day_of_week: { type: Sequelize.INTEGER, allowNull: false },
      period_no: { type: Sequelize.INTEGER, allowNull: false },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'TimetableRooms', key: 'id' },
        onDelete: 'SET NULL',
      },
      is_locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...ts,
    });
    await queryInterface.addIndex('TimetableLessons', ['project_id']);
    await queryInterface.addIndex('TimetableLessons', ['assignment_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TimetableLessons');
    await queryInterface.dropTable('TimetableRuns');
    await queryInterface.dropTable('TimetableConstraints');
    await queryInterface.dropTable('TimetableAssignments');
    await queryInterface.dropTable('TimetableRooms');
    await queryInterface.dropTable('TimetableProjects');
  },
};
