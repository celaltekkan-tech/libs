'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ParentConsents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      consent_type: { type: Sequelize.STRING, allowNull: false },
      granted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      granted_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('ParentConsents', ['tenant_id']);
    await queryInterface.addIndex('ParentConsents', ['student_id', 'consent_type'], {
      unique: true,
      name: 'parent_consents_student_type_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ParentConsents');
  },
};
