'use strict';

const fs = require('fs');
const path = require('path');
const { School } = require('../models');
const schoolLogoUpload = require('./schoolLogoUpload');

const SCHOOL_LOGO_CID = 'school-logo';

async function findSchoolForEmail({ schoolId, tenantId } = {}) {
  if (schoolId) {
    const school = await School.findByPk(schoolId, {
      attributes: ['id', 'name', 'logo_path', 'tenant_id'],
    });
    if (school) return school;
  }
  if (!tenantId) return null;
  const schools = await School.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id', 'name', 'logo_path', 'tenant_id'],
    order: [['id', 'ASC']],
    limit: 8,
  });
  if (schools.length === 0) return null;
  if (schools.length === 1) return schools[0];
  return schools.find((s) => s.logo_path) || schools[0];
}

function logoAttachmentFor(school) {
  if (!school || !school.logo_path) return null;
  const filePath = schoolLogoUpload.absolutePath(school.logo_path);
  if (!fs.existsSync(filePath)) return null;
  return {
    filename: `logo${path.extname(school.logo_path) || '.jpg'}`,
    path: filePath,
    cid: SCHOOL_LOGO_CID,
    contentType: schoolLogoUpload.mimeTypeFor(school.logo_path),
  };
}

async function buildSchoolEmailAssets({ schoolId, tenantId } = {}) {
  const school = await findSchoolForEmail({ schoolId, tenantId });
  const attachment = logoAttachmentFor(school);
  return {
    school,
    schoolName: school?.name || null,
    logoCid: attachment ? SCHOOL_LOGO_CID : null,
    attachments: attachment ? [attachment] : [],
  };
}

module.exports = {
  SCHOOL_LOGO_CID,
  findSchoolForEmail,
  logoAttachmentFor,
  buildSchoolEmailAssets,
};
