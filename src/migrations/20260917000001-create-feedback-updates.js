'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FeedbackUpdates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      feedback_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Feedbacks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      body: { type: Sequelize.TEXT, allowNull: false },
      is_from_platform: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('FeedbackUpdates', ['feedback_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FeedbackUpdates');
  },
};
