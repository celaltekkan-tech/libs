'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkUpdate(
      'Students',
      { registration_status: 'aktif' },
      { registration_status: 'nakil_gelen' },
    );
    await queryInterface.bulkUpdate(
      'Students',
      { registration_status: 'orgun_egitim_disi' },
      { registration_status: 'kayit_silindi' },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkUpdate(
      'Students',
      { registration_status: 'kayit_silindi' },
      { registration_status: 'orgun_egitim_disi' },
    );
  },
};
