'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TeacherDocuments', {
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
      doc_type: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      academic_year: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'taslak' },
      reviewer_note: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('TeacherDocuments', ['tenant_id']);
    await queryInterface.addIndex('TeacherDocuments', ['teacher_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('TeacherDocuments');
  },
};
