'use strict';

const teacherRegister = require('../services/teacherSelfRegisterService');

function parsePositiveInt(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

module.exports = {
  config(req, res) {
    res.json({ success: true, data: { approval_required: true, sms_required: false } });
  },

  async listProvinces(req, res, next) {
    try {
      const rows = await teacherRegister.listProvinces();
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async listDistricts(req, res, next) {
    try {
      const provinceId = parsePositiveInt(req.query.province_id);
      if (!provinceId) {
        return res.status(400).json({ success: false, message: 'province_id zorunludur' });
      }
      const rows = await teacherRegister.listDistricts(provinceId);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async listSchools(req, res, next) {
    try {
      const provinceId = parsePositiveInt(req.query.province_id);
      const districtId = parsePositiveInt(req.query.district_id);
      if (!provinceId || !districtId) {
        return res.status(400).json({ success: false, message: 'province_id ve district_id zorunludur' });
      }
      const rows = await teacherRegister.listLicensedSchools(provinceId, districtId);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async start(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const data = await teacherRegister.startRegistration(payload);
      res.status(201).json({
        success: true,
        message: data.message,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};
