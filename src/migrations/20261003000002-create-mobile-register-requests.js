'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MobileRegisterRequests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Schools', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      national_id: { type: Sequelize.STRING(11), allowNull: false },
      first_name: { type: Sequelize.STRING(80), allowNull: false },
      last_name: { type: Sequelize.STRING(80), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Teachers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      reject_reason: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('MobileRegisterRequests', ['tenant_id', 'status'], {
      name: 'mobile_register_requests_tenant_status',
    });

    // Aynı T.C. için kurumda tek bekleyen istek olabilir.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX mobile_register_requests_pending_unique
        ON "MobileRegisterRequests" (tenant_id, national_id)
        WHERE status = 'pending'
    `);

    const users = await queryInterface.describeTable('Users');
    if (!users.national_id) {
      await queryInterface.addColumn('Users', 'national_id', {
        type: Sequelize.STRING(11),
        allowNull: true,
      });
      await queryInterface.addIndex('Users', ['national_id'], { name: 'users_national_id' });
    }

    // Mevcut öğretmen hesapları da T.C. ile giriş yapabilsin.
    await queryInterface.sequelize.query(`
      UPDATE "Users" u
         SET national_id = t.national_id
        FROM "Teachers" t
       WHERE u.teacher_id = t.id
         AND u.national_id IS NULL
         AND t.national_id ~ '^[0-9]{11}$'
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MobileRegisterRequests');
    const users = await queryInterface.describeTable('Users');
    if (users.national_id) {
      await queryInterface.removeIndex('Users', 'users_national_id');
      await queryInterface.removeColumn('Users', 'national_id');
    }
  },
};
