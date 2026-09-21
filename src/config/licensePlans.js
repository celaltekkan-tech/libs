'use strict';

// Her plan hangi tenant modüllerini (menü/API) açar. Frontend'deki plan kataloğu
// (frontend/src/constants/licensePlans.ts) ile içerik olarak senkron tutulmalıdır.
const PLAN_MODULES = {
  Basic: ['teachers', 'students', 'classrooms'],
  Standart: [
    'schools', 'teachers', 'students', 'classrooms', 'users', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
  Premium: [
    'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
  // Katalogda sunulmuyor; daha önce verilmiş lisanslar için tanım duruyor.
  Kurumsal: [
    'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
};

const ALL_MODULES = [
  'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
  'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
];

// users modülünde kota sayılan hesapların üst sınırı (platform admin hariç).
// Öğretmen ve Rehber Öğretmen bu sayıya dahil değildir. null = sınırsız.
// Basic'te modül kapalıdır (0).
const PLAN_USER_LIMITS = {
  Basic: 0,
  Standart: 2,
  Premium: null,
  Kurumsal: null,
};

const UNLIMITED_ACCOUNT_ROLES = ['Öğretmen', 'Rehber Öğretmen'];

// Tenant başına oluşturulabilecek maksimum okul sayısı.
// null = sınırsız. Tanımsız planda tek okul.
const PLAN_SCHOOL_LIMITS = {
  Basic: 1,
  Standart: 1,
  Premium: 3,
  Kurumsal: null,
};

function resolvePlanKey(planName) {
  if (!planName) return null;
  const normalized = String(planName).toLocaleLowerCase('tr-TR');
  if (normalized === 'free') return 'Basic';
  return Object.keys(PLAN_MODULES).find((name) => name.toLocaleLowerCase('tr-TR') === normalized) || null;
}

function isUnlimitedAccountRole(roleName) {
  const key = String(roleName || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
  return UNLIMITED_ACCOUNT_ROLES.some((name) => name.toLocaleLowerCase('tr-TR') === key);
}

function getModulesForPlan(planName) {
  const key = resolvePlanKey(planName);
  return key ? PLAN_MODULES[key] : [];
}

function getUserLimitForPlan(planName) {
  const key = resolvePlanKey(planName);
  if (!key) return 0;
  return PLAN_USER_LIMITS[key];
}

function getSchoolLimitForPlan(planName) {
  const key = resolvePlanKey(planName);
  if (!key) return 1;
  return PLAN_SCHOOL_LIMITS[key];
}

// Okul kodunu kiracı (Premium; mevcut Kurumsal lisanslar) kendisi belirleyebilir.
// Platform yöneticisi ve tenant admin/supervisor her planda kod atayabilir.
const SCHOOL_CODE_ASSIGN_PLANS = new Set(['Premium', 'Kurumsal']);

// Ana lisansa ek paketler. Modül açmaz; getActiveLicense bunları yok sayar.
// smsQuota: o lisans kaydının kotası. Süre bitince kalan kredi 0 olur;
// yeni SMS lisansı sms_used=0 ile başlar (devreden kredi yok).
const ADDON_PLANS = {
  'SMS 3000': { kind: 'addon', smsQuota: 3000 },
  'SMS 10000': { kind: 'addon', smsQuota: 10000 },
};

function resolveAddonPlanKey(planName) {
  if (!planName) return null;
  const normalized = String(planName).toLocaleLowerCase('tr-TR');
  if (normalized === 'sms') return 'SMS 3000';
  return Object.keys(ADDON_PLANS).find((name) => name.toLocaleLowerCase('tr-TR') === normalized) || null;
}

function isAddonPlan(planName) {
  return Boolean(resolveAddonPlanKey(planName));
}

function isSmsPlan(planName) {
  return Boolean(resolveAddonPlanKey(planName));
}

function getSmsQuotaForPlan(planName) {
  const key = resolveAddonPlanKey(planName);
  if (!key) return null;
  return ADDON_PLANS[key].smsQuota;
}

function canAssignSchoolCode(planName) {
  const key = resolvePlanKey(planName);
  return Boolean(key && SCHOOL_CODE_ASSIGN_PLANS.has(key));
}

module.exports = {
  PLAN_MODULES,
  ALL_MODULES,
  PLAN_USER_LIMITS,
  PLAN_SCHOOL_LIMITS,
  SCHOOL_CODE_ASSIGN_PLANS,
  ADDON_PLANS,
  UNLIMITED_ACCOUNT_ROLES,
  getModulesForPlan,
  getUserLimitForPlan,
  getSchoolLimitForPlan,
  canAssignSchoolCode,
  isUnlimitedAccountRole,
  isAddonPlan,
  isSmsPlan,
  getSmsQuotaForPlan,
};
