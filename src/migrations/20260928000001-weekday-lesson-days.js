'use strict';

// Cumartesi ve pazar müsaitlikte açık kalır ama ders günü değildir.
// 7 gün × 8 ders = 56 açık saat olur; haftalık ders pazartesi–cuma, 5 × 8 = 40 saattir.
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query('SELECT id, days FROM "TimetableProjects"');
    for (const row of rows) {
      const current = Array.isArray(row.days) ? row.days.map(Number) : [];
      const weekdays = [...new Set(current.filter((day) => day >= 1 && day <= 5))].sort((a, b) => a - b);
      const next = weekdays.length ? weekdays : [1, 2, 3, 4, 5];
      const same = current.length === next.length && current.every((day, index) => day === next[index]);
      if (same) continue;
      await queryInterface.sequelize.query('UPDATE "TimetableProjects" SET days = :days::jsonb WHERE id = :id', {
        replacements: { days: JSON.stringify(next), id: row.id },
      });
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query('SELECT id, days FROM "TimetableProjects"');
    for (const row of rows) {
      const current = Array.isArray(row.days) ? row.days.map(Number).filter((day) => day >= 1 && day <= 7) : [];
      const next = [...new Set([...current, 6, 7])].sort((a, b) => a - b);
      await queryInterface.sequelize.query('UPDATE "TimetableProjects" SET days = :days::jsonb WHERE id = :id', {
        replacements: { days: JSON.stringify(next), id: row.id },
      });
    }
  },
};
