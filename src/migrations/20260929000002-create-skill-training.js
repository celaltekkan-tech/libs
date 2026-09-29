'use strict';

/** İşletmede beceri eğitimi: işletme, yerleştirme, devlet katkısı ve SGK bildirimi. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SkillBusinesses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Schools', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING(200), allowNull: false },
      tax_no: { type: Sequelize.STRING(20), allowNull: true },
      sgk_workplace_no: { type: Sequelize.STRING(40), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      field_name: { type: Sequelize.STRING(120), allowNull: true },
      master_name: { type: Sequelize.STRING(120), allowNull: true },
      contact_name: { type: Sequelize.STRING(120), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkillBusinesses', ['tenant_id', 'school_id']);

    await queryInterface.createTable('SkillPlacements', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Schools', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      student_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Students', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      business_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'SkillBusinesses', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      teacher_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Teachers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      academic_year: { type: Sequelize.STRING(20), allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      weekly_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      contract_no: { type: Sequelize.STRING(40), allowNull: true },
      contract_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'aktif' },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkillPlacements', ['tenant_id', 'school_id']);
    await queryInterface.addIndex('SkillPlacements', ['student_id']);

    await queryInterface.createTable('SkillSupportMonths', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      placement_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'SkillPlacements', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      year: { type: Sequelize.INTEGER, allowNull: false },
      month: { type: Sequelize.INTEGER, allowNull: false },
      work_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'bekliyor' },
      paid_at: { type: Sequelize.DATEONLY, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkillSupportMonths', ['placement_id', 'year', 'month'], {
      unique: true,
      name: 'skill_support_month_uq',
    });

    await queryInterface.createTable('SkillSgkNotices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      placement_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'SkillPlacements', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      kind: { type: Sequelize.STRING(16), allowNull: false },
      notice_date: { type: Sequelize.DATEONLY, allowNull: true },
      sgk_ref: { type: Sequelize.STRING(60), allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'taslak' },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkillSgkNotices', ['placement_id', 'kind'], {
      unique: true,
      name: 'skill_sgk_kind_uq',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SkillSgkNotices');
    await queryInterface.dropTable('SkillSupportMonths');
    await queryInterface.dropTable('SkillPlacements');
    await queryInterface.dropTable('SkillBusinesses');
  },
};
