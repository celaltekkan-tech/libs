'use strict';

// Dış kurumdan görevlendirilen öğretmen: kadrolu/sözleşmeli olup kurumun maaş
// değişikliği formuna girmeyen personel. null = kurumun kendi öğretmeni.
// ders_tamamlama | tam_zamanli; ikisinde de ek ders puantajı hazırlanır.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'duty_assignment_type', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'duty_assignment_type');
  },
};
