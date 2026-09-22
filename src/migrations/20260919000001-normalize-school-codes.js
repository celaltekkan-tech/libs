'use strict';

const { randomSchoolCode } = require('../utils/schoolCode');

const CONSTRAINT_NAME = 'schools_code_six_digits_chk';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [schools] = await queryInterface.sequelize.query(
      'SELECT id, code FROM "Schools" ORDER BY id ASC'
    );

    const used = new Set();
    const assignments = schools.map((school) => {
      let code = randomSchoolCode();
      while (used.has(code)) {
        code = randomSchoolCode();
      }
      used.add(code);
      return { id: school.id, code };
    });

    // Unique constraint çakışmasın diye önce geçici kodlara çek.
    if (assignments.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE "Schools" SET code = '__tmp_' || id::text, updated_at = NOW()`
      );

      for (const row of assignments) {
        await queryInterface.sequelize.query(
          'UPDATE "Schools" SET code = :code, updated_at = NOW() WHERE id = :id',
          { replacements: { code: row.code, id: row.id } }
        );
      }
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE "Schools" ADD CONSTRAINT "${CONSTRAINT_NAME}" CHECK (code ~ '^[0-9]{6}$')`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "Schools" DROP CONSTRAINT IF EXISTS "${CONSTRAINT_NAME}"`
    );
  },
};
