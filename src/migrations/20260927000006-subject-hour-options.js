'use strict';

// Aynı ders, aynı sınıf seviyesinde birden fazla haftalık saat olabilir
// (12. sınıfta Türk dili 3 veya 5; seçmeli yabancı dil 2, 8 veya 10).
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex('SubjectClassHours');
    const oldName = 'subject_class_hours_tenant_subject_level_unique';
    if (indexes.some((index) => index.name === oldName)) {
      await queryInterface.removeIndex('SubjectClassHours', oldName);
    }
    const nextName = 'subject_class_hours_level_hours_unique';
    if (!indexes.some((index) => index.name === nextName)) {
      await queryInterface.addIndex('SubjectClassHours', ['tenant_id', 'subject_id', 'class_level', 'weekly_hours'], {
        unique: true,
        name: nextName,
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('SubjectClassHours');
    const nextName = 'subject_class_hours_level_hours_unique';
    if (indexes.some((index) => index.name === nextName)) {
      await queryInterface.removeIndex('SubjectClassHours', nextName);
    }
    const oldName = 'subject_class_hours_tenant_subject_level_unique';
    if (!indexes.some((index) => index.name === oldName)) {
      await queryInterface.addIndex('SubjectClassHours', ['tenant_id', 'subject_id', 'class_level'], {
        unique: true,
        name: oldName,
      });
    }
  },
};
