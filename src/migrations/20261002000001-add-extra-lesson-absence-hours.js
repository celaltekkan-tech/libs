'use strict';

/** Kısmi devamsızlıkta düşülecek ders saati. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ExtraLessonAbsences', 'missed_hours', {
      type: Sequelize.DECIMAL(4, 1),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ExtraLessonAbsences', 'missed_hours');
  },
};
