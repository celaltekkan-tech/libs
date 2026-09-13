'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AnnouncementRecipients', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      announcement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Announcements', key: 'id' },
        onDelete: 'CASCADE',
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Students', key: 'id' },
        onDelete: 'SET NULL',
      },
      phone_number: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'beklemede' },
      provider: { type: Sequelize.STRING, allowNull: true },
      provider_message_id: { type: Sequelize.STRING, allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('AnnouncementRecipients', ['announcement_id']);
    await queryInterface.addIndex('AnnouncementRecipients', ['tenant_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AnnouncementRecipients');
  },
};
