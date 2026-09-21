'use strict';

const teacherRegister = require('../services/teacherSelfRegisterService');
const accessService = require('../services/accessService');
const jwtUtil = require('../utils/jwt');
const audit = require('../services/auditService');

function parsePositiveInt(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function createSessionToken(user) {
  return jwtUtil.sign({
    user_id: user.id,
    tenant_id: user.tenant_id,
    school_id: user.school_id,
    email: user.email,
    role: user.role,
  });
}

async function respondWithSession(res, user, status = 200) {
  const access = await accessService.getUserAccess(user.id);
  const { token, expires_at } = createSessionToken(user);
  return res.status(status).json({
    success: true,
    data: {
      ...(await accessService.buildSessionPayload(access)),
      token,
      expires_at,
    },
  });
}

function auditReq(req, user) {
  return {
    ...req,
    user: { user_id: user.id, tenant_id: user.tenant_id, email: user.email },
    access: { user },
  };
}

module.exports = {
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
        message: data.email_sent
          ? `Doğrulama kodu ${data.email_hint} adresine gönderildi`
          : 'Kayıt alındı ancak e-posta gönderilemedi. Telefon ile doğrulayabilirsiniz.',
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async resendEmail(req, res, next) {
    try {
      const { pending_token } = req.validatedBody || req.body;
      const data = await teacherRegister.resendEmail(pending_token);
      res.json({
        success: true,
        message: `Yeni kod ${data.email_hint} adresine gönderildi`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async requestSms(req, res, next) {
    try {
      const { pending_token, phone } = req.validatedBody || req.body;
      const data = await teacherRegister.requestSms(pending_token, phone);
      res.json({
        success: true,
        message: `Doğrulama kodu ${data.phone_hint} numarasına gönderildi`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async verify(req, res, next) {
    try {
      const { pending_token, code } = req.validatedBody || req.body;
      const user = await teacherRegister.verifyCode(pending_token, code);
      await audit.log(auditReq(req, user), {
        action: 'create',
        entityType: 'auth',
        entityId: user.id,
        summary: `Öğretmen mobil kaydı doğrulandı: ${user.full_name}`,
      });
      return respondWithSession(res, user);
    } catch (err) {
      next(err);
    }
  },
};
