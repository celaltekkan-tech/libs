'use strict';

/** Kültür dersi ile meslek/atölye dersini ayırmak için. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Subjects', 'course_kind', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'kultur',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Subjects', 'course_kind');
  },
};
