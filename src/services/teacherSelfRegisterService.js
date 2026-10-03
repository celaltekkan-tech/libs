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
const { getUserLimitForPlan, isUnlimitedAccountRole } = require('../config/licensePlans');
const legalTimestampLog = require('./legalTimestampLogService');
const { turkishNamesEqual } = require('../utils/trName');
const { assertValidMobilePhone, normalizeMobilePhone, formatMobilePhone } = require('../utils/phone');

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

const SCHOOL_ROLE_LIMITS = {
  Müdür: 1,
  Yönetici: 1,
  'Müdür Yardımcısı': 10,
};

async function listAssignableRoles(tenantId) {
  const roles = await Role.findAll({
    where: {
      [Op.or]: [{ is_system: true, tenant_id: null }, { tenant_id: tenantId }],
    },
    attributes: ['id', 'role_name', 'is_system', 'description'],
    order: [
      ['is_system', 'DESC'],
      ['role_name', 'ASC'],
    ],
  });
  return roles.map((role) => ({
    id: role.id,
    name: role.role_name,
    is_system: role.is_system,
    description: role.description || null,
  }));
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

async function resolveApprovalRole(tenantId, schoolId, { teacher, roleId }) {
  if (teacher) return findTeacherRole(tenantId);
  if (!roleId) {
    throw fail(400, 'ROLE_REQUIRED', 'Eşleşmeyen talep için yetki grubu seçin');
  }
  const role = await Role.findByPk(roleId);
  if (!role || (role.tenant_id && role.tenant_id !== tenantId) || (!role.is_system && role.tenant_id !== tenantId)) {
    throw fail(400, 'ROLE_NOT_FOUND', 'Yetki grubu bulunamadı');
  }

  const headcount = SCHOOL_ROLE_LIMITS[role.role_name];
  if (headcount && schoolId) {
    const rows = await UserSchool.findAll({
      where: { school_id: schoolId, role_id: role.id },
      include: [{
        model: User,
        where: { tenant_id: tenantId, is_active: true },
        attributes: ['id'],
        required: true,
      }],
    });
    if (rows.length >= headcount) {
      throw fail(
        400,
        'SCHOOL_ROLE_LIMIT',
        role.role_name === 'Müdür' || role.role_name === 'Yönetici'
          ? 'Bu okulda müdür bir kişidir. İkinci müdür atanamaz.'
          : 'Bu okulda müdür yardımcısı en fazla 10 kişi olabilir.',
      );
    }
  }

  if (!isUnlimitedAccountRole(role.role_name)) {
    const active = await licenseService.getActiveLicense(tenantId);
    const limit = getUserLimitForPlan(active?.plan);
    if (limit != null) {
      const users = await User.findAll({
        where: { tenant_id: tenantId, is_platform_admin: false, is_active: true },
        include: [{ model: UserSchool, include: [{ model: Role, attributes: ['role_name'] }] }],
        attributes: ['id'],
      });
      const counted = users.filter((user) => {
        const assignments = [...(user.UserSchools || [])].sort((a, b) => Number(a.id) - Number(b.id));
        return !isUnlimitedAccountRole(assignments[0]?.Role?.role_name);
      }).length;
      if (counted >= limit) {
        throw fail(
          403,
          'USER_LIMIT_REACHED',
          `Bu planda öğretmen, rehber öğretmen, müdür ve müdür yardımcısı dışında en fazla ${limit} kullanıcı olabilir.`,
        );
      }
    }
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
  const tckn = normalizeNationalId(nationalId);
  if (!tckn) return null;
  const teachers = await Teacher.findAll({
    where: {
      tenant_id: tenantId,
      national_id: { [Op.ne]: null },
    },
  });
  return teachers.find((row) => normalizeNationalId(row.national_id) === tckn) || null;
}

function matchedFields(request, teacher) {
  const fields = [];
  if (
    turkishNamesEqual(teacher.first_name, request.first_name)
    && turkishNamesEqual(teacher.last_name, request.last_name)
  ) {
    fields.push('name');
  }
  const requestedTc = normalizeNationalId(request.national_id);
  const oursTc = normalizeNationalId(teacher.national_id);
  if (requestedTc && oursTc && requestedTc === oursTc) fields.push('national_id');
  const requestedPhone = normalizeMobilePhone(request.phone);
  const oursPhone = normalizeMobilePhone(teacher.phone);
  if (requestedPhone && oursPhone && requestedPhone === oursPhone) fields.push('phone');
  const requestedEmail = String(request.email || '').trim().toLowerCase();
  const oursEmail = String(teacher.email || '').trim().toLowerCase();
  if (requestedEmail && oursEmail && requestedEmail === oursEmail) fields.push('email');
  return fields;
}

async function assessTeacherMatch(tenantId, schoolId, request) {
  const teachers = await Teacher.findAll({ where: { tenant_id: tenantId } });
  const hits = teachers
    .map((teacher) => ({ teacher, fields: matchedFields(request, teacher) }))
    .filter((hit) => hit.fields.length > 0);

  hits.sort((a, b) => {
    if (b.fields.length !== a.fields.length) return b.fields.length - a.fields.length;
    const schoolA = Number(a.teacher.school_id) === Number(schoolId) ? 1 : 0;
    const schoolB = Number(b.teacher.school_id) === Number(schoolId) ? 1 : 0;
    return schoolB - schoolA;
  });

  const best = hits[0] || null;
  return {
    registered: hits.length > 0,
    teacher: best?.teacher || null,
    matched_fields: best?.fields || [],
    matches: hits.map((hit) => ({
      teacher_id: hit.teacher.id,
      full_name: `${hit.teacher.first_name || ''} ${hit.teacher.last_name || ''}`.trim(),
      fields: hit.fields,
    })),
  };
}

function snapshotTeacher(teacher) {
  if (!teacher) return null;
  return {
    id: teacher.id,
    first_name: teacher.first_name || null,
    last_name: teacher.last_name || null,
    national_id: teacher.national_id || null,
    phone: teacher.phone || null,
    email: teacher.email || null,
  };
}

function buildMismatches(request, teacher) {
  const mismatches = [];
  const requestedTc = normalizeNationalId(request.national_id);
  const oursTc = teacher ? normalizeNationalId(teacher.national_id) : null;
  const requestedPhone = normalizeMobilePhone(request.phone);
  const oursPhone = teacher ? normalizeMobilePhone(teacher.phone) : null;

  if (!oursTc) {
    mismatches.push({ field: 'national_id', kind: 'empty', ours: null, requested: requestedTc });
  } else if (oursTc !== requestedTc) {
    mismatches.push({ field: 'national_id', kind: 'mismatch', ours: oursTc, requested: requestedTc });
  }

  if (!oursPhone) {
    mismatches.push({
      field: 'phone',
      kind: 'empty',
      ours: null,
      requested: request.phone || null,
    });
  } else if (oursPhone !== requestedPhone) {
    mismatches.push({
      field: 'phone',
      kind: 'mismatch',
      ours: formatMobilePhone(oursPhone),
      requested: request.phone || null,
    });
  }

  return mismatches;
}

function warningMessage(fullName) {
  return `Lütfen ${fullName} öğretmen ile irtibata geçiniz; "talebi siz mi oluşturdunuz".`;
}

function unregisteredWarningMessage() {
  return 'Bu öğretmen kayıtlı bir öğretmen değil! Yine de onaylamak istiyor musunuz?';
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
    email: data.email || null,
    status: data.status,
    teacher_id: data.teacher_id,
    user_id: data.user_id,
    reject_reason: data.reject_reason,
    reviewed_at: data.reviewed_at,
    reviewed_by_user_id: data.reviewed_by_user_id || data.ReviewedBy?.id || null,
    reviewed_by_name: data.ReviewedBy?.full_name || null,
    reviewed_by_email: data.ReviewedBy?.email || null,
    hidden_at: data.hidden_at || null,
    hidden_by_name: data.HiddenBy?.full_name || null,
    tenant_name: data.Tenant?.name || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

async function serializeRequestWithMatch(row) {
  const base = serializeRequest(row);
  const match = await assessTeacherMatch(row.tenant_id, row.school_id, row);
  const mismatches = match.registered ? buildMismatches(row, match.teacher) : [];
  return {
    ...base,
    teacher_on_file: snapshotTeacher(match.teacher),
    matched_fields: match.matched_fields,
    not_registered: !match.registered,
    mismatches,
    warning_message: !match.registered
      ? unregisteredWarningMessage()
      : mismatches.length
        ? warningMessage(base.full_name)
        : null,
  };
}

const requestInclude = [
  { model: School, attributes: ['id', 'name'] },
  { model: Tenant, attributes: ['id', 'name'] },
  { model: User, as: 'ReviewedBy', attributes: ['id', 'full_name', 'email'] },
  { model: User, as: 'HiddenBy', attributes: ['id', 'full_name'] },
];

function visibilityWhere(visibility) {
  if (visibility === 'hidden') return { hidden_at: { [Op.not]: null } };
  if (visibility === 'all') return {};
  return { hidden_at: null };
}

function searchWhere(q) {
  const term = String(q || '').trim();
  if (!term) return null;
  const like = `%${term}%`;
  return {
    [Op.or]: [
      { first_name: { [Op.iLike]: like } },
      { last_name: { [Op.iLike]: like } },
      { national_id: { [Op.iLike]: like } },
      { phone: { [Op.iLike]: like } },
      { email: { [Op.iLike]: like } },
      sequelize.where(
        sequelize.fn(
          'concat',
          sequelize.col('MobileRegisterRequest.first_name'),
          ' ',
          sequelize.col('MobileRegisterRequest.last_name'),
        ),
        { [Op.iLike]: like },
      ),
      sequelize.where(sequelize.col('School.name'), { [Op.iLike]: like }),
      sequelize.where(sequelize.col('Tenant.name'), { [Op.iLike]: like }),
    ],
  };
}

function requestSnapshot(request) {
  return {
    id: request.id,
    tenant_id: request.tenant_id,
    tenant_name: request.Tenant?.name || null,
    school_id: request.school_id,
    school_name: request.School?.name || null,
    national_id: request.national_id,
    first_name: request.first_name,
    last_name: request.last_name,
    phone: request.phone,
    email: request.email || null,
    status: request.status,
    hidden_at: request.hidden_at || null,
  };
}

async function startRegistration({ school_id, national_id, first_name, last_name, phone, email }) {
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
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm) {
    throw fail(400, 'VALIDATION_ERROR', 'E-posta zorunludur');
  }

  const existingUser = await User.unscoped().findOne({
    where: {
      [Op.or]: [{ national_id: tckn }, { email: placeholderEmail(tckn) }, { email: emailNorm }],
    },
  });
  if (existingUser?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu T.C. kimlik numarası veya e-posta zaten kayıtlı. Şifrenizle giriş yapın.');
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
    email: emailNorm,
    status: 'pending',
    teacher_id: teacher?.id || null,
  });

  const fullName = `${first} ${last}`.trim();
  await notifyTenantApprovers(
    school.tenant_id,
    'Yeni mobil kayıt isteği',
    `${fullName} (${tckn}) ${school.name} için mobil kayıt istedi. Telefon: ${phoneNorm} · E-posta: ${emailNorm}`,
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

async function listLinkableTeachers(tenantId) {
  const rows = await Teacher.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id', 'first_name', 'last_name', 'national_id', 'phone', 'email', 'school_id'],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    national_id: row.national_id || null,
    phone: row.phone || null,
    email: row.email || null,
    school_id: row.school_id || null,
  }));
}

async function resolveApprovalTeacher(tenantId, request, selectedTeacherId) {
  const match = await assessTeacherMatch(tenantId, request.school_id, request);
  const suggestedId = match.teacher?.id || null;
  if (selectedTeacherId === undefined) {
    return {
      ...match,
      link_mode: match.teacher ? 'auto' : 'none',
      suggested_teacher_id: suggestedId,
    };
  }
  if (!selectedTeacherId) {
    return {
      registered: false,
      teacher: null,
      matched_fields: [],
      matches: match.matches,
      link_mode: 'none',
      suggested_teacher_id: suggestedId,
    };
  }
  const teacher = await Teacher.findByPk(selectedTeacherId);
  if (!teacher || teacher.tenant_id !== tenantId) {
    throw fail(400, 'TEACHER_NOT_FOUND', 'Seçilen öğretmen bu kuruma ait değil');
  }
  return {
    registered: true,
    teacher,
    matched_fields: matchedFields(request, teacher),
    matches: match.matches,
    link_mode: suggestedId === teacher.id ? 'auto' : 'manual',
    suggested_teacher_id: suggestedId,
  };
}

async function listRequests(tenantId, { status, q, visibility = 'visible' } = {}) {
  const where = { tenant_id: tenantId, ...visibilityWhere(visibility) };
  if (status) where.status = status;
  const search = searchWhere(q);
  if (search) where[Op.and] = [search];
  const rows = await MobileRegisterRequest.findAll({
    where,
    include: requestInclude,
    subQuery: false,
    order: [['created_at', 'DESC']],
  });
  return Promise.all(rows.map((row) => serializeRequestWithMatch(row)));
}

async function listAllRequests({ status, q, visibility = 'all', tenantId } = {}) {
  const where = { ...visibilityWhere(visibility) };
  if (tenantId) where.tenant_id = tenantId;
  if (status) where.status = status;
  const search = searchWhere(q);
  if (search) where[Op.and] = [search];
  const rows = await MobileRegisterRequest.findAll({
    where,
    include: requestInclude,
    subQuery: false,
    order: [['created_at', 'DESC']],
    limit: 1000,
  });
  return Promise.all(rows.map((row) => serializeRequestWithMatch(row)));
}

async function loadAnyRequest(id) {
  const request = await MobileRegisterRequest.findByPk(id, { include: requestInclude });
  if (!request) throw fail(404, 'REQUEST_NOT_FOUND', 'Kayıt isteği bulunamadı');
  return request;
}

async function writeVisibilityLog(request, hidden, actor, transaction) {
  await legalTimestampLog.record({
    tenantId: request.tenant_id,
    schoolId: request.school_id,
    requestId: request.id,
    eventType: hidden ? 'mobile_register_hidden' : 'mobile_register_shown',
    actor,
    payload: {
      event: hidden ? 'mobile_register_hidden' : 'mobile_register_shown',
      law: '5651',
      occurred_at: new Date().toISOString(),
      approver: { id: actor.userId || null, name: actor.name || null, email: actor.email || null },
      request: requestSnapshot(request),
      hidden,
    },
    transaction,
  });
}

async function applyVisibility(request, hidden, actor) {
  await sequelize.transaction(async (transaction) => {
    await writeVisibilityLog(request, hidden, actor, transaction);
    await request.update(
      hidden
        ? { hidden_at: new Date(), hidden_by_user_id: actor.userId || null }
        : { hidden_at: null, hidden_by_user_id: null },
      { transaction },
    );
  });
}

async function setRequestVisibility(tenantId, id, hidden, actor) {
  const request = await loadTenantRequest(tenantId, id);
  await applyVisibility(request, hidden, actor);
  return serializeRequestWithMatch(await loadTenantRequest(tenantId, id));
}

async function setAnyRequestVisibility(id, hidden, actor) {
  const request = await loadAnyRequest(id);
  await applyVisibility(request, hidden, actor);
  return serializeRequestWithMatch(await loadAnyRequest(id));
}

async function deleteAnyRequest(id, actor) {
  const request = await loadAnyRequest(id);
  const snapshot = requestSnapshot(request);
  await sequelize.transaction(async (transaction) => {
    await legalTimestampLog.record({
      tenantId: request.tenant_id,
      schoolId: request.school_id,
      requestId: request.id,
      eventType: 'mobile_register_deleted',
      actor,
      payload: {
        event: 'mobile_register_deleted',
        law: '5651',
        occurred_at: new Date().toISOString(),
        approver: { id: actor.userId || null, name: actor.name || null, email: actor.email || null },
        request: snapshot,
      },
      transaction,
    });
    await request.destroy({ transaction });
  });
  return snapshot;
}

async function loadTenantRequest(tenantId, id) {
  const request = await MobileRegisterRequest.findByPk(id, { include: requestInclude });
  if (!request || request.tenant_id !== tenantId) {
    throw fail(404, 'REQUEST_NOT_FOUND', 'Kayıt isteği bulunamadı');
  }
  return request;
}

async function approveRequest(tenantId, id, {
  password,
  confirmMismatch = false,
  teacherId: selectedTeacherId,
  roleId,
  reviewerUserId,
  reviewerName,
  reviewerEmail,
  ip,
  userAgent,
}) {
  const request = await loadTenantRequest(tenantId, id);
  if (request.status !== 'pending') {
    throw fail(409, 'REQUEST_NOT_PENDING', 'Bu istek zaten sonuçlandırılmış');
  }
  const plainPassword = assertEasyPassword(password);
  const tckn = request.national_id;
  const fullName = `${request.first_name} ${request.last_name}`.trim();
  const emailNorm = String(request.email || '').trim().toLowerCase() || placeholderEmail(tckn);

  const match = await resolveApprovalTeacher(tenantId, request, selectedTeacherId);
  const teacher = match.teacher;
  const role = await resolveApprovalRole(tenantId, request.school_id, { teacher, roleId });
  const teacherBefore = snapshotTeacher(teacher);
  const mismatches = match.registered ? buildMismatches(request, teacher) : [];
  const warnings = [];
  if (!match.registered) {
    warnings.push({
      code: 'TEACHER_NOT_REGISTERED',
      message: unregisteredWarningMessage(),
    });
  } else if (mismatches.length) {
    warnings.push({
      code: 'MISMATCH_CONFIRMATION_REQUIRED',
      message: warningMessage(fullName),
      mismatches,
    });
  }
  if (warnings.length && !confirmMismatch) {
    const warning = warnings[0];
    const err = fail(409, warning.code, warning.message);
    err.mismatches = mismatches;
    err.warning_message = warning.message;
    throw err;
  }

  let actorName = reviewerName || null;
  let actorEmail = reviewerEmail || null;
  if (reviewerUserId && (!actorName || !actorEmail)) {
    const reviewer = await User.findByPk(reviewerUserId, { attributes: ['id', 'full_name', 'email'] });
    actorName = actorName || reviewer?.full_name || null;
    actorEmail = actorEmail || reviewer?.email || null;
  }

  const existingByNational = await User.unscoped().findOne({
    where: { [Op.or]: [{ national_id: tckn }, { email: placeholderEmail(tckn) }] },
  });
  if (existingByNational?.is_active) {
    throw fail(409, 'ALREADY_REGISTERED', 'Bu T.C. kimlik numarası zaten bir hesaba bağlı');
  }

  const existingByEmail = await User.unscoped().findOne({ where: { email: emailNorm } });
  if (existingByEmail) {
    const samePerson =
      existingByEmail.national_id === tckn || (teacher && existingByEmail.teacher_id === teacher.id);
    if (!samePerson) {
      throw fail(409, 'EMAIL_IN_USE', 'Bu e-posta zaten kullanılıyor');
    }
  }

  if (teacher) {
    const existingByTeacher = await User.unscoped().findOne({ where: { teacher_id: teacher.id } });
    if (existingByTeacher?.is_active) {
      throw fail(409, 'ALREADY_REGISTERED', 'Bu öğretmenin zaten aktif bir hesabı var');
    }
  }

  const password_hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const approvedAt = new Date();

  const user = await sequelize.transaction(async (transaction) => {
    if (teacher) {
      const teacherUpdates = { phone: request.phone, email: emailNorm };
      if (!normalizeNationalId(teacher.national_id)) teacherUpdates.national_id = tckn;
      await teacher.update(teacherUpdates, { transaction });
    }

    let account = existingByNational
      || existingByEmail
      || (teacher ? await User.unscoped().findOne({ where: { teacher_id: teacher.id }, transaction }) : null);

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
        reviewed_at: approvedAt,
        reject_reason: null,
      },
      { transaction },
    );

    if (teacher) await teacher.reload({ transaction });
    const teacherAfter = snapshotTeacher(teacher);

    await legalTimestampLog.record({
      tenantId,
      schoolId: request.school_id,
      requestId: request.id,
      eventType: 'mobile_register_account_created',
      actor: {
        userId: reviewerUserId || null,
        name: actorName,
        email: actorEmail,
        ip,
        userAgent,
      },
      payload: {
        event: 'mobile_register_account_created',
        law: '5651',
        occurred_at: approvedAt.toISOString(),
        approver: {
          id: reviewerUserId || null,
          name: actorName,
          email: actorEmail,
        },
        request: {
          id: request.id,
          national_id: request.national_id,
          first_name: request.first_name,
          last_name: request.last_name,
          phone: request.phone,
          email: emailNorm,
          school_id: request.school_id,
          school_name: request.School?.name || null,
        },
        teacher_before: teacherBefore,
        teacher_after: teacherAfter,
        not_registered: !match.registered,
        link_mode: match.link_mode,
        suggested_teacher_id: match.suggested_teacher_id,
        matched_fields: match.matched_fields,
        teacher_matches: match.matches,
        mismatches,
        warnings: warnings.map((warning) => ({ ...warning, acknowledged: true })),
        warning_acknowledged: warnings.length > 0,
        warning_message: warnings[0]?.message || null,
        linked_teacher_id: teacher?.id || null,
        role_id: role.id,
        role_name: role.role_name,
        created_user: {
          id: account.id,
          full_name: fullName,
          national_id: tckn,
          email: emailNorm,
          phone: request.phone,
          teacher_id: teacher?.id || null,
        },
      },
      transaction,
    });

    return account;
  });

  return { user, request: await serializeRequestWithMatch(await loadTenantRequest(tenantId, request.id)) };
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
  return serializeRequestWithMatch(await loadTenantRequest(tenantId, request.id));
}

module.exports = {
  suggestEasyPassword,
  listProvinces,
  listDistricts,
  listLicensedSchools,
  startRegistration,
  findPendingByNationalId,
  listAssignableRoles,
  listLinkableTeachers,
  listRequests,
  listAllRequests,
  setRequestVisibility,
  setAnyRequestVisibility,
  deleteAnyRequest,
  approveRequest,
  rejectRequest,
};
