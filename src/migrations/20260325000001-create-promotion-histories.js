'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PromotionHistories', {
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
      previous_degree: { type: Sequelize.STRING, allowNull: true },
      previous_rank: { type: Sequelize.STRING, allowNull: true },
      previous_degree_rank_date: { type: Sequelize.DATE, allowNull: true },
      new_degree: { type: Sequelize.STRING, allowNull: false },
      new_rank: { type: Sequelize.STRING, allowNull: false },
      new_degree_rank_date: { type: Sequelize.DATE, allowNull: false },
      note: { type: Sequelize.STRING, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('PromotionHistories', ['tenant_id']);
    await queryInterface.addIndex('PromotionHistories', ['teacher_id']);
    await queryInterface.addIndex('PromotionHistories', ['new_degree_rank_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PromotionHistories');
  },
};
