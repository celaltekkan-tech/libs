'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE "Feedbacks" SET status = 'waiting' WHERE status = 'evaluated'`
    );
  },

  async down() {
    // Geri alınamaz: evaluated durumu kaldırıldı
  },
};
