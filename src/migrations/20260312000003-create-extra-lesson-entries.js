'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ExtraLessonEntries', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Teachers', key: 'id' },
        onDelete: 'CASCADE',
      },
      year: { type: Sequelize.INTEGER, allowNull: false },
      month: { type: Sequelize.INTEGER, allowNull: false },
      category: { type: Sequelize.STRING, allowNull: false },
      hours: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ExtraLessonEntries', ['tenant_id']);
    await queryInterface.addIndex('ExtraLessonEntries', ['teacher_id']);
    await queryInterface.addIndex('ExtraLessonEntries', ['tenant_id', 'year', 'month']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ExtraLessonEntries');
  },
};
