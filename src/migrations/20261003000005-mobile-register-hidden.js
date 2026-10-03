'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('MobileRegisterRequests');
    if (!table.hidden_at) {
      await queryInterface.addColumn('MobileRegisterRequests', 'hidden_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.hidden_by_user_id) {
      await queryInterface.addColumn('MobileRegisterRequests', 'hidden_by_user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('MobileRegisterRequests');
    if (table.hidden_by_user_id) {
      await queryInterface.removeColumn('MobileRegisterRequests', 'hidden_by_user_id');
    }
    if (table.hidden_at) {
      await queryInterface.removeColumn('MobileRegisterRequests', 'hidden_at');
    }
  },
};
