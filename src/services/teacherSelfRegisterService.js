'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const {
  User,
  Teacher,
  School,
  Tenant,
  License,
  Role,
  UserSchool,
  Province,
  District,
  DirectorySchool,
  sequelize,
} = require('../models');
const { foldTurkishName, turkishNamesEqual } = require('../utils/trName');
const jwtUtil = require('../utils/jwt');
const licenseService = require('./licenseService');
const { sendEmail, EmailConfigError, EMAIL_STATUS } = require('./emailEngine');
const { buildSchoolEmailAssets } = require('./schoolEmailAssets');
const { sendSms, SMS_STATUS, SmsConfigError } = require('./smsEngine');
const { assertValidMobilePhone } = require('../utils/phone');
const { buildTeacherRegisterVerificationEmail } = require('./emailTemplates/teacherRegisterVerification');

const BCRYPT_ROUNDS = 10;
const PENDING_EXPIRES = process.env.TEACHER_REGISTER_TOKEN_TTL || '30m';
const CODE_TTL_MS = (Number(process.env.TEACHER_REGISTER_CODE_TTL_MINUTES) || 10) * 60 * 1000;
const MAX_CODES_PER_DAY = Number(process.env.TEACHER_REGISTER_MAX_CODES_PER_DAY) || 8;
const TEACHER_ROLE_NAME = 'Öğretmen';

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function foldLastName(value) {
  return foldTurkishName(value);
}

function normalizePersonnelNo(value) {
  return String(value || '').trim();
}

function maskEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at < 1) return '***';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

function istanbulDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function createPendingToken(user) {
  return jwtUtil.sign(
    {
      purpose: 'teacher_register_pending',
      user_id: user.id,
      tenant_id: user.tenant_id,
      teacher_id: user.teacher_id,
    },
    { expiresIn: PENDING_EXPIRES },
  );
}

function verifyPendingToken(tempToken) {
  let payload;
  try {
    payload = jwtUtil.verify(tempToken);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw fail(
      401,
      expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      expired ? 'Doğrulama süresi doldu, kaydı yeniden başlatın' : 'Geçersiz doğrulama oturumu',
    );
  }
  if (payload.purpose !== 'teacher_register_pending' || !payload.user_id) {
    throw fail(401, 'TOKEN_INVALID', 'Geçersiz doğrulama oturumu');
  }
  return payload;
}

async function assertSchoolLicensed(school) {
  if (!school) {
    throw fail(404, 'SCHOOL_NOT_FOUND', 'Okul bulunamadı');
  }
  const tenant = school.Tenant || (await Tenant.findByPk(school.tenant_id));
  if (!tenant || !tenant.is_active) {
    throw fail(403, 'SCHOOL_LICENSE_INVALID', 'Bu okulun sistemde geçerli bir lisansı yok');
  }
  const active = await licenseService.getActiveLicense(school.tenant_id);
  if (!active) {
    throw fail(403, 'SCHOOL_LICENSE_INVALID', 'Bu okulun sistemde geçerli bir lisansı yok');
  }
  return { tenant, license: active };
}

async function findTeacherRole(tenantId) {
  const role = await Role.findOne({
    where: {
      role_name: TEACHER_ROLE_NAME,
      [Op.or]: [
        { is_system: true, tenant_id: null },
        { tenant_id: tenantId },
      ],
    },
    order: [
      ['is_system', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  if (!role) {
    throw fail(500, 'ROLE_NOT_FOUND', 'Öğretmen yetki grubu tanımlı değil');
  }
  return role;
}

async function matchTeacher(school, personnelNo, lastName) {
  const sicil = normalizePersonnelNo(personnelNo);
  const soyad = foldLastName(lastName);
  if (!sicil || !soyad) {
    throw fail(400, 'VALIDATION_ERROR', 'Sicil numarası ve soyad zorunludur');
  }

  const teachers = await Teacher.findAll({
    where: {
      tenant_id: school.tenant_id,
      personnel_type: 'ogretmen',
      personnel_category_id: null,
      personnel_no: { [Op.ne]: null },
      [Op.or]: [{ school_id: school.id }, { school_id: null }],
    },
  });

  const match = teachers.find(
    (row) =>
      normalizePersonnelNo(row.personnel_no).toLocaleLowerCase('tr-TR') === sicil.toLocaleLowerCase('tr-TR') &&
      turkishNamesEqual(row.last_name, lastName),
  );
  if (!match) {
    throw fail(
      404,
      'TEACHER_NOT_FOUND',
      'Sicil numarası ve soyad bu okuldaki öğretmen kaydıyla eşleşmedi',
    );
  }
  return match;
}

function getCodeState(user) {
  const today = istanbulDateString();
  const sameDay = user.sms_login_requests_date === today;
  const count = sameDay ? Number(user.sms_login_requests_count || 0) : 0;
  return {
    today,
    count,
    remaining: Math.max(0, MAX_CODES_PER_DAY - count),
  };
}

async function storeVerificationCode(user, extra = {}) {
  const state = getCodeState(user);
  if (state.count >= MAX_CODES_PER_DAY) {
    throw fail(
      429,
      'CODE_DAILY_LIMIT',
      `Bugün için doğrulama kodu hakkı doldu (en fazla ${MAX_CODES_PER_DAY})`,
    );
  }
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const nextCount = state.count + 1;
  await user.update({
    sms_login_code_hash: codeHash,
    sms_login_code_expires_at: expiresAt,
    sms_login_requests_date: state.today,
    sms_login_requests_count: nextCount,
    ...extra,
  });
  return {
    code,
    expires_at: expiresAt.toISOString(),
    requests_remaining: Math.max(0, MAX_CODES_PER_DAY - nextCount),
    max_requests: MAX_CODES_PER_DAY,
  };
}

async function sendRegisterEmail(user, code) {
  const minutes = Math.round(CODE_TTL_MS / 60000);
  const branding = await buildSchoolEmailAssets({
    schoolId: user.school_id,
    tenantId: user.tenant_id,
  });
  const { subject, text, html } = buildTeacherRegisterVerificationEmail({
    fullName: user.full_name,
    code,
    minutes,
    schoolName: branding.schoolName,
    logoCid: branding.logoCid,
  });

  try {
    const result = await sendEmail({
      to: user.email,
      subject,
      text,
      html,
      attachments: branding.attachments,
    });
    if (result.status !== EMAIL_STATUS.SUCCESS) {
      return { sent: false, error: result.error || 'E-posta gönderilemedi' };
    }
    return { sent: true, error: null };
  } catch (err) {
    if (err instanceof EmailConfigError) {
      return { sent: false, error: 'E-posta motoru yapılandırılmamış' };
    }
    return { sent: false, error: err.message || 'E-posta gönderilemedi' };
  }
}

async function sendRegisterSms(phone, code) {
  const minutes = Math.round(CODE_TTL_MS / 60000);
  let result;
  try {
    result = await sendSms({
      phoneNumber: phone,
      message: `Okul Idare dogrulama kodunuz: ${code}. Kod ${minutes} dk gecerlidir.`,
    });
  } catch (err) {
    if (err instanceof SmsConfigError) {
      throw fail(500, 'SMS_CONFIG', 'SMS motoru yapılandırma hatası');
    }
    throw err;
  }
  if (result.status !== SMS_STATUS.SUCCESS) {
    throw fail(502, 'SMS_SEND_FAILED', result.error || 'SMS gönderilemedi');
  }
}

async function loadPendingUser(tempToken) {
  const payload = verifyPendingToken(tempToken);
  const user = await User.unscoped().findByPk(payload.user_id);
  if (!user || user.teacher_id !== payload.teacher_id) {
    throw fail(401, 'TOKEN_INVALID', 'Geçersiz doğrulama oturumu');
  }
  if (user.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu hesap zaten doğrulanmış. E-posta ve şifrenizle giriş yapın.');
  }
  return user;
}

async function listProvinces() {
  return Province.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  });
}

async function listDistricts(provinceId) {
  return District.findAll({
    where: { province_id: provinceId },
    attributes: ['id', 'province_id', 'name'],
    order: [['name', 'ASC']],
  });
}

async function listLicensedSchools(provinceId, districtId) {
  const province = await Province.findByPk(provinceId, { attributes: ['id', 'name'] });
  const district = await District.findByPk(districtId, { attributes: ['id', 'name', 'province_id'] });
  if (!province || !district || Number(district.province_id) !== Number(province.id)) return [];

  const [byLocation, byDirectory, byTeacherCity, byTenantTeacherCity] = await Promise.all([
    School.findAll({
      where: { province_id: provinceId, district_id: districtId },
      include: [{ model: Tenant, attributes: ['id', 'is_active'] }],
      attributes: ['id', 'name', 'tenant_id'],
    }),
    School.findAll({
      include: [
        {
          model: DirectorySchool,
          required: true,
          attributes: [],
          where: { province_id: provinceId, district_id: districtId },
        },
        { model: Tenant, attributes: ['id', 'is_active'] },
      ],
      attributes: ['id', 'name', 'tenant_id'],
    }),
    School.findAll({
      include: [
        { model: Tenant, attributes: ['id', 'is_active'] },
        {
          model: Teacher,
          required: true,
          attributes: ['id'],
          where: { city: province.name, district: district.name },
        },
      ],
      attributes: ['id', 'name', 'tenant_id'],
    }),
    School.findAll({
      include: [
        {
          model: Tenant,
          attributes: ['id', 'is_active'],
          required: true,
          include: [
            {
              model: Teacher,
              required: true,
              attributes: ['id'],
              where: { city: province.name, district: district.name },
            },
          ],
        },
      ],
      attributes: ['id', 'name', 'tenant_id'],
    }),
  ]);

  const merged = new Map();
  for (const row of [...byLocation, ...byDirectory, ...byTeacherCity, ...byTenantTeacherCity]) {
    merged.set(row.id, row);
  }
  const schools = [...merged.values()];
  const tenantIds = [...new Set(schools.map((s) => s.tenant_id))];
  if (tenantIds.length === 0) return [];

  const licenses = await License.findAll({
    where: {
      tenant_id: tenantIds,
      status: 'active',
      [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: new Date() } }],
    },
    attributes: ['tenant_id'],
  });
  const licensedTenants = new Set(licenses.map((row) => Number(row.tenant_id)));

  return schools
    .filter((school) => school.Tenant?.is_active !== false && licensedTenants.has(Number(school.tenant_id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((school) => ({ id: school.id, name: school.name }));
}

async function startRegistration({ school_id, personnel_no, last_name, email }) {
  const school = await School.findByPk(school_id, {
    include: [{ model: Tenant, attributes: ['id', 'is_active', 'name'] }],
  });
  await assertSchoolLicensed(school);
  const teacher = await matchTeacher(school, personnel_no, last_name);
  const emailNorm = String(email).trim().toLowerCase();
  const sicil = normalizePersonnelNo(personnel_no);
  const fullName = `${teacher.first_name} ${teacher.last_name}`.trim();

  const existingByTeacher = await User.unscoped().findOne({ where: { teacher_id: teacher.id } });
  if (existingByTeacher?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu öğretmen zaten kayıtlı. E-posta ve şifrenizle giriş yapın.');
  }

  const existingByEmail = await User.unscoped().findOne({ where: { email: emailNorm } });
  if (existingByEmail && existingByEmail.teacher_id !== teacher.id) {
    throw fail(409, 'EMAIL_IN_USE', 'Bu e-posta zaten kullanılıyor. Giriş yapın veya başka bir adres deneyin.');
  }
  if (existingByEmail?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu e-posta zaten kayıtlı. Şifrenizle giriş yapın.');
  }

  const role = await findTeacherRole(school.tenant_id);
  const password_hash = await bcrypt.hash(sicil, BCRYPT_ROUNDS);

  const user = await sequelize.transaction(async (transaction) => {
    let pending = existingByTeacher || existingByEmail || null;
    if (pending) {
      await pending.update(
        {
          tenant_id: school.tenant_id,
          school_id: school.id,
          teacher_id: teacher.id,
          full_name: fullName,
          email: emailNorm,
          password_hash,
          role: 'user',
          is_active: false,
        },
        { transaction },
      );
    } else {
      pending = await User.create(
        {
          tenant_id: school.tenant_id,
          school_id: school.id,
          teacher_id: teacher.id,
          full_name: fullName,
          email: emailNorm,
          password_hash,
          role: 'user',
          is_active: false,
        },
        { transaction },
      );
    }

    const assignment = await UserSchool.findOne({ where: { user_id: pending.id }, transaction });
    if (assignment) {
      await assignment.update({ school_id: school.id, role_id: role.id }, { transaction });
    } else {
      await UserSchool.create(
        { user_id: pending.id, school_id: school.id, role_id: role.id },
        { transaction },
      );
    }

    await teacher.update({ email: emailNorm }, { transaction });
    return pending;
  });

  const issued = await storeVerificationCode(user);
  const mail = await sendRegisterEmail(user, issued.code);
  const pending = createPendingToken(user);

  return {
    pending_token: pending.token,
    expires_at: pending.expires_at,
    email_hint: maskEmail(user.email),
    email_sent: mail.sent,
    email_error: mail.sent ? null : mail.error,
    code_expires_at: issued.expires_at,
    requests_remaining: issued.requests_remaining,
    max_requests: issued.max_requests,
  };
}

async function resendEmail(tempToken) {
  const user = await loadPendingUser(tempToken);
  const issued = await storeVerificationCode(user);
  const mail = await sendRegisterEmail(user, issued.code);
  if (!mail.sent) {
    throw fail(502, 'EMAIL_SEND_FAILED', mail.error || 'E-posta gönderilemedi');
  }
  return {
    email_hint: maskEmail(user.email),
    email_sent: true,
    code_expires_at: issued.expires_at,
    requests_remaining: issued.requests_remaining,
    max_requests: issued.max_requests,
  };
}

async function requestSms(tempToken, phoneRaw) {
  const user = await loadPendingUser(tempToken);
  const phone = assertValidMobilePhone(phoneRaw, { required: true });
  const issued = await storeVerificationCode(user, { phone });
  await sendRegisterSms(phone, issued.code);

  if (user.teacher_id) {
    const teacher = await Teacher.findByPk(user.teacher_id);
    if (teacher) await teacher.update({ phone });
  }

  const { maskPhone } = require('./smsLoginService');
  return {
    phone_hint: maskPhone(phone),
    code_expires_at: issued.expires_at,
    requests_remaining: issued.requests_remaining,
    max_requests: issued.max_requests,
  };
}

async function verifyCode(tempToken, code) {
  const user = await loadPendingUser(tempToken);
  if (!user.sms_login_code_hash || !user.sms_login_code_expires_at) {
    throw fail(400, 'CODE_REQUIRED', 'Önce e-posta veya SMS doğrulama kodu isteyin');
  }
  if (new Date(user.sms_login_code_expires_at).getTime() < Date.now()) {
    throw fail(400, 'CODE_EXPIRED', 'Doğrulama kodunun süresi doldu');
  }
  const ok = await bcrypt.compare(String(code || '').replace(/\D/g, ''), user.sms_login_code_hash);
  if (!ok) {
    throw fail(400, 'CODE_INVALID', 'Doğrulama kodu hatalı');
  }

  await user.update({
    is_active: true,
    sms_login_code_hash: null,
    sms_login_code_expires_at: null,
    last_login_at: new Date(),
  });

  if (user.teacher_id) {
    const teacher = await Teacher.findByPk(user.teacher_id);
    if (teacher) {
      const updates = {};
      if (user.email) updates.email = String(user.email).trim().toLowerCase();
      if (user.phone) updates.phone = user.phone;
      if (Object.keys(updates).length) await teacher.update(updates);
    }
  }
  return user;
}

module.exports = {
  listProvinces,
  listDistricts,
  listLicensedSchools,
  startRegistration,
  resendEmail,
  requestSms,
  verifyCode,
  maskEmail,
};
