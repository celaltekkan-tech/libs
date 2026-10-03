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
  Permission,
  Province,
  District,
  DirectorySchool,
  MobileRegisterRequest,
  Notification,
  sequelize,
} = require('../models');
const licenseService = require('./licenseService');
const { assertValidMobilePhone } = require('../utils/phone');

const BCRYPT_ROUNDS = 10;
const TEACHER_ROLE_NAME = 'Öğretmen';
const PLACEHOLDER_EMAIL_DOMAIN = 'tc.oids.local';
const APPROVER_PERMISSIONS = ['mobile_register_requests.read', 'mobile_register_requests.update'];

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeNationalId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{11}$/.test(digits) ? digits : null;
}

function placeholderEmail(nationalId) {
  return `${nationalId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function assertEasyPassword(value) {
  const password = String(value || '');
  if (password.length < 6 || password.length > 32) {
    throw fail(400, 'PASSWORD_WEAK', 'Şifre en az 6 karakter olmalı');
  }
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) {
    throw fail(400, 'PASSWORD_WEAK', 'Şifrede en az 1 harf ve 1 rakam olmalı');
  }
  return password;
}

function suggestEasyPassword() {
  const words = ['elma', 'okul', 'kedi', 'masa', 'sari', 'mavi', 'topu', 'evim', 'cayi', 'sut1'];
  const word = words[crypto.randomInt(0, words.length)];
  const digits = String(crypto.randomInt(10, 100));
  return `${word}${digits}`.slice(0, 8);
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

async function findTeacherByNationalId(tenantId, nationalId) {
  const teachers = await Teacher.findAll({
    where: {
      tenant_id: tenantId,
      national_id: { [Op.ne]: null },
    },
  });
  return teachers.find((row) => normalizeNationalId(row.national_id) === nationalId) || null;
}

async function notifyTenantApprovers(tenantId, title, body) {
  const users = await User.findAll({
    where: { tenant_id: tenantId, is_active: true, is_platform_admin: false },
    include: [
      {
        model: UserSchool,
        include: [{ model: Role, include: [{ model: Permission, through: { attributes: [] } }] }],
      },
    ],
  });

  const recipients = users.filter((user) => {
    if (['admin', 'supervisor'].includes(user.role)) return true;
    return (user.UserSchools || []).some((assignment) =>
      (assignment.Role?.Permissions || []).some((perm) => APPROVER_PERMISSIONS.includes(perm.permission_key)),
    );
  });

  if (recipients.length === 0) return;
  await Notification.bulkCreate(
    recipients.map((user) => ({
      recipient_user_id: user.id,
      tenant_id: tenantId,
      sender_user_id: null,
      title,
      body,
    })),
  );
}

function serializeRequest(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  return {
    id: data.id,
    tenant_id: data.tenant_id,
    school_id: data.school_id,
    school_name: data.School?.name || null,
    national_id: data.national_id,
    first_name: data.first_name,
    last_name: data.last_name,
    full_name: `${data.first_name} ${data.last_name}`.trim(),
    phone: data.phone,
    status: data.status,
    teacher_id: data.teacher_id,
    user_id: data.user_id,
    reject_reason: data.reject_reason,
    reviewed_at: data.reviewed_at,
    reviewed_by_name: data.ReviewedBy?.full_name || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

const requestInclude = [
  { model: School, attributes: ['id', 'name'] },
  { model: User, as: 'ReviewedBy', attributes: ['id', 'full_name'] },
];

async function startRegistration({ school_id, national_id, first_name, last_name, phone }) {
  const school = await School.findByPk(school_id, {
    include: [{ model: Tenant, attributes: ['id', 'is_active', 'name'] }],
  });
  const { tenant } = await assertSchoolLicensed(school);

  const tckn = normalizeNationalId(national_id);
  if (!tckn) {
    throw fail(400, 'VALIDATION_ERROR', 'Geçerli bir T.C. kimlik numarası girin');
  }
  const first = String(first_name || '').trim();
  const last = String(last_name || '').trim();
  if (!first || !last) {
    throw fail(400, 'VALIDATION_ERROR', 'Ad ve soyad zorunludur');
  }
  const phoneNorm = assertValidMobilePhone(phone, { required: true });

  const existingUser = await User.unscoped().findOne({
    where: {
      [Op.or]: [{ national_id: tckn }, { email: placeholderEmail(tckn) }],
    },
  });
  if (existingUser?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu T.C. kimlik numarası zaten kayıtlı. Şifrenizle giriş yapın.');
  }

  const pending = await MobileRegisterRequest.findOne({
    where: { tenant_id: school.tenant_id, national_id: tckn, status: 'pending' },
  });
  if (pending) {
    throw fail(
      409,
      'REQUEST_PENDING',
      'Bu T.C. için bekleyen bir kayıt isteği zaten var. Okul yönetiminin onayını bekleyin.',
    );
  }

  const teacher = await findTeacherByNationalId(school.tenant_id, tckn);

  const request = await MobileRegisterRequest.create({
    tenant_id: school.tenant_id,
    school_id: school.id,
    national_id: tckn,
    first_name: first,
    last_name: last,
    phone: phoneNorm,
    status: 'pending',
    teacher_id: teacher?.id || null,
  });

  const fullName = `${first} ${last}`.trim();
  await notifyTenantApprovers(
    school.tenant_id,
    'Yeni mobil kayıt isteği',
    `${fullName} (${tckn}) ${school.name} için mobil kayıt istedi. Telefon: ${phoneNorm}`,
  );

  return {
    request_id: request.id,
    status: 'pending',
    school_name: school.name,
    tenant_name: tenant.name,
    message: `${school.name} yönetimine kayıt isteğiniz gönderildi. Onaylanınca T.C. kimlik numaranız ve okulun belirlediği şifre ile giriş yapabilirsiniz.`,
  };
}

async function findPendingByNationalId(nationalId) {
  const tckn = normalizeNationalId(nationalId);
  if (!tckn) return null;
  return MobileRegisterRequest.findOne({
    where: { national_id: tckn, status: 'pending' },
    include: [{ model: School, attributes: ['id', 'name'] }],
  });
}

async function listRequests(tenantId, { status } = {}) {
  const where = { tenant_id: tenantId };
  if (status) where.status = status;
  const rows = await MobileRegisterRequest.findAll({
    where,
    include: requestInclude,
    order: [
      ['status', 'ASC'],
      ['created_at', 'DESC'],
    ],
  });
  return rows.map(serializeRequest);
}

async function loadTenantRequest(tenantId, id) {
  const request = await MobileRegisterRequest.findByPk(id, { include: requestInclude });
  if (!request || request.tenant_id !== tenantId) {
    throw fail(404, 'REQUEST_NOT_FOUND', 'Kayıt isteği bulunamadı');
  }
  return request;
}

async function approveRequest(tenantId, id, { password, reviewerUserId }) {
  const request = await loadTenantRequest(tenantId, id);
  if (request.status !== 'pending') {
    throw fail(409, 'REQUEST_NOT_PENDING', 'Bu istek zaten sonuçlandırılmış');
  }
  const plainPassword = assertEasyPassword(password);
  const tckn = request.national_id;
  const fullName = `${request.first_name} ${request.last_name}`.trim();
  const emailNorm = placeholderEmail(tckn);

  const existingByNational = await User.unscoped().findOne({
    where: { [Op.or]: [{ national_id: tckn }, { email: emailNorm }] },
  });
  if (existingByNational?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu T.C. kimlik numarası zaten bir hesaba bağlı');
  }

  const teacher = (request.teacher_id && (await Teacher.findByPk(request.teacher_id)))
    || (await findTeacherByNationalId(tenantId, tckn));

  if (teacher) {
    const existingByTeacher = await User.unscoped().findOne({ where: { teacher_id: teacher.id } });
    if (existingByTeacher?.is_active) {
      throw fail(409, 'ALREADY_REGISTERED', 'Bu öğretmenin zaten aktif bir hesabı var');
    }
  }

  const role = await findTeacherRole(tenantId);
  const password_hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

  const user = await sequelize.transaction(async (transaction) => {
    if (teacher) {
      await teacher.update({ phone: request.phone }, { transaction });
    }

    let account = existingByNational || (teacher
      ? await User.unscoped().findOne({ where: { teacher_id: teacher.id }, transaction })
      : null);

    const fields = {
      tenant_id: tenantId,
      school_id: request.school_id,
      teacher_id: teacher?.id || null,
      full_name: fullName,
      email: emailNorm,
      national_id: tckn,
      phone: request.phone,
      password_hash,
      role: 'user',
      is_active: true,
      sms_login_code_hash: null,
      sms_login_code_expires_at: null,
    };

    if (account) {
      await account.update(fields, { transaction });
    } else {
      account = await User.create(fields, { transaction });
    }

    const assignment = await UserSchool.findOne({ where: { user_id: account.id }, transaction });
    if (assignment) {
      await assignment.update({ school_id: request.school_id, role_id: role.id }, { transaction });
    } else {
      await UserSchool.create(
        { user_id: account.id, school_id: request.school_id, role_id: role.id },
        { transaction },
      );
    }

    await request.update(
      {
        status: 'approved',
        teacher_id: teacher?.id || request.teacher_id,
        user_id: account.id,
        reviewed_by_user_id: reviewerUserId || null,
        reviewed_at: new Date(),
        reject_reason: null,
      },
      { transaction },
    );

    return account;
  });

  return { user, request: serializeRequest(await loadTenantRequest(tenantId, request.id)) };
}

async function rejectRequest(tenantId, id, { reason, reviewerUserId }) {
  const request = await loadTenantRequest(tenantId, id);
  if (request.status !== 'pending') {
    throw fail(409, 'REQUEST_NOT_PENDING', 'Bu istek zaten sonuçlandırılmış');
  }
  await request.update({
    status: 'rejected',
    reviewed_by_user_id: reviewerUserId || null,
    reviewed_at: new Date(),
    reject_reason: String(reason || '').trim() || null,
  });
  return serializeRequest(await loadTenantRequest(tenantId, request.id));
}

module.exports = {
  suggestEasyPassword,
  listProvinces,
  listDistricts,
  listLicensedSchools,
  startRegistration,
  findPendingByNationalId,
  listRequests,
  approveRequest,
  rejectRequest,
};
