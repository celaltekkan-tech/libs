'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GEO_DIR = path.join(__dirname, '..', 'seed-data', 'geo');
const BATCH = 800;

function loadSchools() {
  const gz = fs.readFileSync(path.join(GEO_DIR, 'directory-schools.json.gz'));
  return JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
}

function rowKey(row) {
  return `${row.province_id}|${row.district_id || 0}|${row.name}|${row.school_type}`;
}

module.exports = {
  async up(queryInterface) {
    const seeded = loadSchools().filter((row) => row.code);
    if (seeded.length === 0) return;

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id, province_id, district_id, name, school_type FROM "DirectorySchools"'
    );
    const byKey = new Map(existing.map((row) => [rowKey(row), row.id]));
    const pairs = [];
    for (const row of seeded) {
      const id = byKey.get(rowKey(row));
      if (id) pairs.push({ id, code: row.code });
    }
    if (pairs.length === 0) return;

    const now = new Date().toISOString();
    for (let i = 0; i < pairs.length; i += BATCH) {
      const chunk = pairs.slice(i, i + BATCH);
      const values = chunk
        .map((p) => `(${Number(p.id)}::int, '${String(p.code).replace(/[^0-9]/g, '')}'::varchar)`)
        .join(',');
      await queryInterface.sequelize.query(
        `UPDATE "DirectorySchools" AS d
            SET code = v.code, updated_at = :now
           FROM (VALUES ${values}) AS v(id, code)
          WHERE d.id = v.id`,
        { replacements: { now } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('UPDATE "DirectorySchools" SET code = NULL');
  },
};
