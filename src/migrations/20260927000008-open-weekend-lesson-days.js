'use strict';

// Cumartesi ve pazar ders günü olarak kapalı gelmesin.
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query('SELECT id, days FROM "TimetableProjects"');
    for (const row of rows) {
      const current = Array.isArray(row.days) ? row.days.map(Number).filter((day) => day >= 1 && day <= 7) : [];
      const next = [...new Set([...current, 6, 7])].sort((a, b) => a - b);
      const same = current.length === next.length && current.every((day, index) => day === next[index]);
      if (same) continue;
      await queryInterface.sequelize.query('UPDATE "TimetableProjects" SET days = :days::jsonb WHERE id = :id', {
        replacements: { days: JSON.stringify(next), id: row.id },
      });
    }
  },

  async down() {
    // Hafta sonunu yeniden kapatmak kullanıcı kararıdır; geri alınmaz.
  },
};
