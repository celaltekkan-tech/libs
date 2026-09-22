'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GEO_DIR = path.join(__dirname, '..', 'seed-data', 'geo');
const BATCH_SIZE = 1000;

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(GEO_DIR, filename), 'utf8'));
}

function loadSchools() {
  const gz = fs.readFileSync(path.join(GEO_DIR, 'directory-schools.json.gz'));
  return JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
}

function withTimestamps(rows, now) {
  return rows.map((row) => ({ ...row, created_at: now, updated_at: now }));
}

async function bulkInsertBatched(queryInterface, table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await queryInterface.bulkInsert(table, rows.slice(i, i + BATCH_SIZE));
  }
}

module.exports = {
  async up(queryInterface) {
    const [[provinceCount]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS count FROM "Provinces"'
    );
    if (provinceCount.count > 0) return;

    const now = new Date();
    const provinces = withTimestamps(loadJson('provinces.json'), now);
    const districts = withTimestamps(loadJson('districts.json'), now);
    const schools = withTimestamps(loadSchools(), now);

    await bulkInsertBatched(queryInterface, 'Provinces', provinces);
    await bulkInsertBatched(queryInterface, 'Districts', districts);
    await bulkInsertBatched(queryInterface, 'DirectorySchools', schools);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('DirectorySchools', null, {});
    await queryInterface.bulkDelete('Districts', null, {});
    await queryInterface.bulkDelete('Provinces', null, {});
  },
};
