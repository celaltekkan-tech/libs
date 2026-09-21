'use strict';

const { DirectorySchool } = require('../models');

async function applyDirectorySchoolToPayload(payload) {
  if (!payload || !payload.directory_school_id) return payload;

  const dir = await DirectorySchool.findByPk(payload.directory_school_id);
  if (!dir) {
    const err = new Error('Katalogda böyle bir okul bulunamadı');
    err.status = 400;
    throw err;
  }

  payload.directory_school_id = dir.id;
  payload.name = dir.name;
  payload.school_type = dir.school_type;
  payload.province_id = dir.province_id;
  payload.district_id = dir.district_id;
  if (dir.code) payload.code = dir.code;
  return payload;
}

module.exports = { applyDirectorySchoolToPayload };
