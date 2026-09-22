'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DisciplineIncidents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Schools', key: 'id' },
        onDelete: 'CASCADE',
      },
      incident_code: { type: Sequelize.STRING, allowNull: false },
      academic_year: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      incident_date: { type: Sequelize.DATEONLY, allowNull: false },
      incident_time: { type: Sequelize.STRING, allowNull: true },
      location: { type: Sequelize.STRING, allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      complainant_name: { type: Sequelize.STRING, allowNull: true },
      complaint_ref_date: { type: Sequelize.DATEONLY, allowNull: true },
      complaint_ref_no: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'acik' },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineIncidents', ['tenant_id']);
    await queryInterface.addIndex('DisciplineIncidents', ['school_id']);
    await queryInterface.addIndex('DisciplineIncidents', ['school_id', 'incident_code'], { unique: true });

    await queryInterface.createTable('DisciplineParticipants', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      incident_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineIncidents', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'kayitli' },
      health_status: { type: Sequelize.TEXT, allowNull: true },
      economic_status_mother: { type: Sequelize.STRING, allowNull: true },
      economic_status_father: { type: Sequelize.STRING, allowNull: true },
      family_together: { type: Sequelize.STRING, allowNull: true },
      parents_alive: { type: Sequelize.STRING, allowNull: true },
      parents_biological: { type: Sequelize.STRING, allowNull: true },
      raised_environment: { type: Sequelize.TEXT, allowNull: true },
      family_address: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineParticipants', ['incident_id']);
    await queryInterface.addIndex('DisciplineParticipants', ['student_id']);
    await queryInterface.addIndex('DisciplineParticipants', ['incident_id', 'student_id'], { unique: true });

    await queryInterface.createTable('DisciplineStatements', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      incident_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineIncidents', key: 'id' },
        onDelete: 'CASCADE',
      },
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'CASCADE',
      },
      statement_type: { type: Sequelize.STRING, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: true },
      taken_by: { type: Sequelize.STRING, allowNull: true },
      written_by: { type: Sequelize.STRING, allowNull: true },
      taken_at: { type: Sequelize.DATEONLY, allowNull: true },
      location: { type: Sequelize.STRING, allowNull: true },
      questions: { type: Sequelize.JSONB, allowNull: true },
      student_home_phone: { type: Sequelize.STRING, allowNull: true },
      student_mobile_phone: { type: Sequelize.STRING, allowNull: true },
      student_home_address: { type: Sequelize.TEXT, allowNull: true },
      guardian_work_phone: { type: Sequelize.STRING, allowNull: true },
      guardian_mobile_phone: { type: Sequelize.STRING, allowNull: true },
      guardian_work_address: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineStatements', ['incident_id']);
    await queryInterface.addIndex('DisciplineStatements', ['participant_id']);

    await queryInterface.createTable('DisciplineInfoRequests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      incident_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineIncidents', key: 'id' },
        onDelete: 'CASCADE',
      },
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'CASCADE',
      },
      source_type: { type: Sequelize.STRING, allowNull: false },
      source_name: { type: Sequelize.STRING, allowNull: true },
      source_branch: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      response_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineInfoRequests', ['incident_id']);
    await queryInterface.addIndex('DisciplineInfoRequests', ['participant_id']);

    await queryInterface.createTable('DisciplineMeetingNotices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      incident_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineIncidents', key: 'id' },
        onDelete: 'CASCADE',
      },
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'CASCADE',
      },
      notice_type: { type: Sequelize.STRING, allowNull: false },
      meeting_date: { type: Sequelize.DATEONLY, allowNull: true },
      meeting_time: { type: Sequelize.STRING, allowNull: true },
      location: { type: Sequelize.STRING, allowNull: true },
      agenda: { type: Sequelize.TEXT, allowNull: true },
      board_members: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      acknowledged: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      acknowledged_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineMeetingNotices', ['incident_id']);

    await queryInterface.createTable('DisciplineRegulationArticles', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      article_no: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      default_sanction_type: { type: Sequelize.STRING, allowNull: true },
      source: { type: Sequelize.STRING, allowNull: false, defaultValue: 'custom' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineRegulationArticles', ['tenant_id']);

    await queryInterface.createTable('DisciplineDecisions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      incident_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineIncidents', key: 'id' },
        onDelete: 'CASCADE',
      },
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'CASCADE',
      },
      decision_no: { type: Sequelize.STRING, allowNull: true },
      decision_date: { type: Sequelize.DATEONLY, allowNull: true },
      prior_sanctions_summary: { type: Sequelize.TEXT, allowNull: true },
      behavior_date: { type: Sequelize.DATEONLY, allowNull: true },
      behavior_place: { type: Sequelize.STRING, allowNull: true },
      behavior_type: { type: Sequelize.STRING, allowNull: true },
      behavior_reason: { type: Sequelize.TEXT, allowNull: true },
      statements_summary: { type: Sequelize.TEXT, allowNull: true },
      mitigating_aggravating_factors: { type: Sequelize.TEXT, allowNull: true },
      board_opinion: { type: Sequelize.TEXT, allowNull: true },
      regulation_article_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'DisciplineRegulationArticles', key: 'id' },
        onDelete: 'SET NULL',
      },
      regulation_article_text: { type: Sequelize.STRING, allowNull: true },
      sanction_type: { type: Sequelize.STRING, allowNull: true },
      sanction_days: { type: Sequelize.INTEGER, allowNull: true },
      board_members: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      board_decision: { type: Sequelize.TEXT, allowNull: true },
      approved_by: { type: Sequelize.STRING, allowNull: true },
      approved_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'taslak' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineDecisions', ['incident_id']);
    await queryInterface.addIndex('DisciplineDecisions', ['participant_id']);

    await queryInterface.createTable('DisciplineNotifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      decision_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineDecisions', key: 'id' },
        onDelete: 'CASCADE',
      },
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'CASCADE',
      },
      notification_type: { type: Sequelize.STRING, allowNull: false },
      sent_date: { type: Sequelize.DATEONLY, allowNull: true },
      sanction_start_date: { type: Sequelize.DATEONLY, allowNull: true },
      sanction_end_date: { type: Sequelize.DATEONLY, allowNull: true },
      broken_behavior_point: { type: Sequelize.INTEGER, allowNull: true },
      remaining_behavior_point: { type: Sequelize.INTEGER, allowNull: true },
      acknowledged_by: { type: Sequelize.STRING, allowNull: true },
      acknowledged_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineNotifications', ['decision_id']);
    await queryInterface.addIndex('DisciplineNotifications', ['participant_id']);

    await queryInterface.createTable('DisciplineBehaviorPoints', {
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
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'DisciplineParticipants', key: 'id' },
        onDelete: 'SET NULL',
      },
      decision_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'DisciplineDecisions', key: 'id' },
        onDelete: 'SET NULL',
      },
      academic_year: { type: Sequelize.STRING, allowNull: false },
      points_deducted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      points_restored: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      restore_date: { type: Sequelize.DATEONLY, allowNull: true },
      reason: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('DisciplineBehaviorPoints', ['tenant_id']);
    await queryInterface.addIndex('DisciplineBehaviorPoints', ['student_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DisciplineBehaviorPoints');
    await queryInterface.dropTable('DisciplineNotifications');
    await queryInterface.dropTable('DisciplineDecisions');
    await queryInterface.dropTable('DisciplineRegulationArticles');
    await queryInterface.dropTable('DisciplineMeetingNotices');
    await queryInterface.dropTable('DisciplineInfoRequests');
    await queryInterface.dropTable('DisciplineStatements');
    await queryInterface.dropTable('DisciplineParticipants');
    await queryInterface.dropTable('DisciplineIncidents');
  },
};
