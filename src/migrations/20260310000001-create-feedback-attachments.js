'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FeedbackAttachments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      feedback_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Feedbacks', key: 'id' },
        onDelete: 'CASCADE',
      },
      original_name: { type: Sequelize.STRING, allowNull: false },
      stored_name: { type: Sequelize.STRING, allowNull: false },
      mime_type: { type: Sequelize.STRING, allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('FeedbackAttachments', ['feedback_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FeedbackAttachments');
  },
};
