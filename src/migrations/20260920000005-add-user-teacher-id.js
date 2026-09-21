'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'teacher_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Teachers', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('Users', ['teacher_id'], {
      unique: true,
      name: 'users_teacher_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', 'users_teacher_id_unique');
    await queryInterface.removeColumn('Users', 'teacher_id');
  },
};
