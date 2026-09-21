'use strict';

const { Op } = require('sequelize');
const { Province, District, DirectorySchool } = require('../models');
const directorySchoolLogo = require('../services/directorySchoolLogo');

function parsePositiveInt(value, fallback = null) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function escapeLike(value) {
  return String(value).replace(/[%_\\]/g, '\\$&');
}

function serializeDirectorySchool(row) {
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  delete json.logo_path;
  delete json.logo_checked_at;
  return {
    ...json,
    logo_url: directorySchoolLogo.logoUrlFor(row),
  };
}

module.exports = {
  async listProvinces(req, res, next) {
    try {
      const rows = await Province.findAll({
        attributes: ['id', 'name', 'slug', 'region'],
        order: [['name', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async listDistricts(req, res, next) {
    try {
      const provinceId = parsePositiveInt(req.query.province_id || req.params.provinceId);
      if (!provinceId) {
        return res.status(400).json({ success: false, message: 'province_id zorunludur' });
      }

      const rows = await District.findAll({
        where: { province_id: provinceId },
        attributes: ['id', 'province_id', 'name', 'slug'],
        order: [['name', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async listDirectorySchools(req, res, next) {
    try {
      const provinceId = parsePositiveInt(req.query.province_id);
      const districtId = parsePositiveInt(req.query.district_id);
      const schoolType = String(req.query.school_type || '').trim();
      const q = String(req.query.q || '').trim();
      const requestedLimit = parsePositiveInt(req.query.limit);
      const defaultLimit = provinceId && districtId ? 500 : 20;
      const limit = Math.min(requestedLimit || defaultLimit, 1000);
      const offset = Math.max(parsePositiveInt(req.query.offset, 0) || 0, 0);

      const where = {};
      if (provinceId) where.province_id = provinceId;
      if (districtId) where.district_id = districtId;
      if (schoolType === 'ortaokul' || schoolType === 'lise') where.school_type = schoolType;
      if (q) {
        where.name = { [Op.iLike]: `%${escapeLike(q)}%` };
      }

      const { rows, count } = await DirectorySchool.findAndCountAll({
        where,
        include: [
          { model: Province, attributes: ['id', 'name'] },
          { model: District, attributes: ['id', 'name'] },
        ],
        order: [
          ['name', 'ASC'],
          ['id', 'ASC'],
        ],
        limit,
        offset,
      });

      res.json({
        success: true,
        data: rows.map(serializeDirectorySchool),
        meta: { total: count, limit, offset },
      });
    } catch (err) {
      next(err);
    }
  },

  async getDirectorySchoolLogo(req, res, next) {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Geçersiz okul' });
      }
      const school = await DirectorySchool.findByPk(id);
      if (!school) {
        return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      }

      const stored = await directorySchoolLogo.ensureDirectorySchoolLogo(school);
      if (!stored) {
        return res.status(404).json({ success: false, message: 'Logo bulunamadı' });
      }

      const filePath = directorySchoolLogo.absolutePath(stored);
      res.setHeader('Content-Type', directorySchoolLogo.mimeTypeFor(stored));
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(filePath, (err) => {
        if (err) next(err);
      });
    } catch (err) {
      next(err);
    }
  },
};
