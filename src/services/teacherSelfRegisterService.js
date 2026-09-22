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
const { sendSms, SMS_STATUS, SmsConfigError } = require('./smsEngine');
const { assertValidMobilePhone, normalizeMobilePhone } = require('../utils/phone');
const { maskPhone } = require('./smsLoginService');

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

function normalizeNationalId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{11}$/.test(digits) ? digits : null;
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

async function matchTeacher(school, nationalIdRaw, lastName) {
  const tckn = normalizeNationalId(nationalIdRaw);
  const soyad = foldLastName(lastName);
  if (!tckn) {
    throw fail(400, 'VALIDATION_ERROR', 'Geçerli bir T.C. kimlik numarası girin');
  }
  if (!soyad) {
    throw fail(400, 'VALIDATION_ERROR', 'Soyad zorunludur');
  }

  const teachers = await Teacher.findAll({
    where: {
      tenant_id: school.tenant_id,
      personnel_type: 'ogretmen',
      personnel_category_id: null,
      national_id: { [Op.ne]: null },
      [Op.or]: [{ school_id: school.id }, { school_id: null }],
    },
  });

  const match = teachers.find(
    (row) => normalizeNationalId(row.national_id) === tckn && turkishNamesEqual(row.last_name, lastName),
  );
  if (!match) {
    throw fail(
      404,
      'TEACHER_NOT_FOUND',
      'T.C. kimlik numarası ve soyad bu okuldaki öğretmen kaydıyla eşleşmedi',
    );
  }
  return match;
}

function assertPhoneBelongsToTeacher(teacher, phone) {
  const onFile = normalizeMobilePhone(teacher.phone);
  if (!onFile) {
    throw fail(
      409,
      'TEACHER_PHONE_MISSING',
      'Bu öğretmen için sistemde kayıtlı bir telefon numarası yok. Okul yönetimiyle iletişime geçin.',
    );
  }
  if (normalizeMobilePhone(phone) !== onFile) {
    throw fail(
      403,
      'PHONE_MISMATCH',
      'Girilen telefon numarası bu öğretmenin kayıtlı numarasıyla eşleşmedi',
    );
  }
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

async function startRegistration({ school_id, national_id, last_name, email, phone }) {
  const school = await School.findByPk(school_id, {
    include: [{ model: Tenant, attributes: ['id', 'is_active', 'name'] }],
  });
  await assertSchoolLicensed(school);
  const teacher = await matchTeacher(school, national_id, last_name);
  const phoneNorm = assertValidMobilePhone(phone, { required: true });
  assertPhoneBelongsToTeacher(teacher, phoneNorm);
  const emailNorm = String(email).trim().toLowerCase();
  const tckn = normalizeNationalId(national_id);
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
  const password_hash = await bcrypt.hash(tckn, BCRYPT_ROUNDS);

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
          phone: phoneNorm,
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
          phone: phoneNorm,
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
  await sendRegisterSms(phoneNorm, issued.code);
  const pending = createPendingToken(user);

  return {
    pending_token: pending.token,
    expires_at: pending.expires_at,
    phone_hint: maskPhone(phoneNorm),
    code_expires_at: issued.expires_at,
    requests_remaining: issued.requests_remaining,
    max_requests: issued.max_requests,
  };
}

async function resendSms(tempToken) {
  const user = await loadPendingUser(tempToken);
  const phone = assertValidMobilePhone(user.phone, { required: true });
  const issued = await storeVerificationCode(user);
  await sendRegisterSms(phone, issued.code);
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
    throw fail(400, 'CODE_REQUIRED', 'Önce SMS doğrulama kodu isteyin');
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
  resendSms,
  verifyCode,
};
