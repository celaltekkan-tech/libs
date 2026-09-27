'use strict';

// Ders dağıtımı için Bilsa benzeri altyapı:
// - Branches: branş kodu/adı; ders ve öğretmen eşleşmesi (öğretmen tarafı brans metniyle eşlenir)
// - Subjects: ders havuzu bayrakları (B1 bölünebilir, B2 birleşebilir, seçmeli, rehberlik, faaliyet)
// - SubjectClassHours.block_pattern: seviyeye özel blok düzeni (6 -> 2+2+2)
// - TimetableAssignments.co_teacher_ids: bir sınıf dersine 2.-5. öğretmen
// - TimetableAvailabilities: okul/öğretmen/şube/mekan/ders zaman tablosu (kapalı / istenmiyor)
// - ScheduleEntries.co_teacher_ids: yayınlanan programda ortak öğretmenler
module.exports = {
  async up(queryInterface, Sequelize) {
    const ts = {
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    };

    await queryInterface.createTable('Branches', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      code: { type: Sequelize.STRING(20), allowNull: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      ...ts,
    });
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX branches_tenant_name_unique ON "Branches" (tenant_id, lower(name))'
    );

    await queryInterface.addColumn('Subjects', 'branch_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Branches', key: 'id' },
      onDelete: 'SET NULL',
    });
    for (const [col, def] of [
      ['allow_split', false],
      ['allow_merge', false],
      ['is_elective', false],
      ['is_guidance', false],
      ['is_activity', false],
    ]) {
      await queryInterface.addColumn('Subjects', col, { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: def });
    }
    await queryInterface.addColumn('Subjects', 'elective_group', { type: Sequelize.STRING(30), allowNull: true });

    await queryInterface.addColumn('SubjectClassHours', 'block_pattern', { type: Sequelize.STRING(40), allowNull: true });

    await queryInterface.addColumn('TimetableAssignments', 'co_teacher_ids', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull: false,
      defaultValue: [],
    });
    // null: dersin havuzdaki ayarı geçerli
    await queryInterface.addColumn('TimetableAssignments', 'allow_split', { type: Sequelize.BOOLEAN, allowNull: true });
    await queryInterface.addColumn('TimetableAssignments', 'allow_merge', { type: Sequelize.BOOLEAN, allowNull: true });

    await queryInterface.createTable('TimetableAvailabilities', {
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
      // school | teacher | classroom | room | subject
      entity_type: { type: Sequelize.STRING(16), allowNull: false },
      // school için 0
      entity_id: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      // {"gün-saat": "closed" | "avoid"}; listede olmayan hücre açıktır
      cells: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ...ts,
    });
    await queryInterface.addIndex('TimetableAvailabilities', ['project_id', 'entity_type', 'entity_id'], {
      unique: true,
      name: 'timetable_availabilities_entity_unique',
    });

    await queryInterface.addColumn('ScheduleEntries', 'co_teacher_ids', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull: false,
      defaultValue: [],
    });

    // Mevcut öğretmen branşlarından branş listesi; aynı adlı dersler branşa bağlanır.
    await queryInterface.sequelize.query(`
      INSERT INTO "Branches" (tenant_id, name, created_at, updated_at)
      SELECT DISTINCT ON (t.tenant_id, lower(trim(t.brans))) t.tenant_id, trim(t.brans), now(), now()
      FROM "Teachers" t
      WHERE t.brans IS NOT NULL AND trim(t.brans) <> '' AND length(trim(t.brans)) <= 100
        AND COALESCE(t.personnel_type, 'ogretmen') = 'ogretmen'
      ON CONFLICT DO NOTHING
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Subjects" s SET branch_id = b.id
      FROM "Branches" b
      WHERE b.tenant_id = s.tenant_id AND lower(b.name) = lower(trim(s.name)) AND s.branch_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ScheduleEntries', 'co_teacher_ids');
    await queryInterface.dropTable('TimetableAvailabilities');
    await queryInterface.removeColumn('TimetableAssignments', 'allow_merge');
    await queryInterface.removeColumn('TimetableAssignments', 'allow_split');
    await queryInterface.removeColumn('TimetableAssignments', 'co_teacher_ids');
    await queryInterface.removeColumn('SubjectClassHours', 'block_pattern');
    for (const col of ['elective_group', 'is_activity', 'is_guidance', 'is_elective', 'allow_merge', 'allow_split', 'branch_id']) {
      await queryInterface.removeColumn('Subjects', col);
    }
    await queryInterface.dropTable('Branches');
  },
};
