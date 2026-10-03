'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DemoResetSettings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      schedule_time: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '03:00' },
      snapshot: { type: Sequelize.JSONB, allowNull: true },
      snapshot_taken_at: { type: Sequelize.DATE, allowNull: true },
      last_reset_at: { type: Sequelize.DATE, allowNull: true },
      last_reset_trigger: { type: Sequelize.STRING(20), allowNull: true },
      last_reset_summary: { type: Sequelize.JSONB, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.bulkInsert('DemoResetSettings', [
      {
        schedule_time: '03:00',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.sequelize.query(`
      UPDATE "Tenants"
         SET data = COALESCE(data, '{}'::jsonb) || '{"demo": true}'::jsonb,
             updated_at = NOW()
       WHERE name = 'Demo Eğitim Kurumu'
         AND COALESCE(data->>'demo', '') IS DISTINCT FROM 'true'
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DemoResetSettings');
  },
};
