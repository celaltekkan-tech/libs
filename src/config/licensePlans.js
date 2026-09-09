'use strict';

// Her plan hangi tenant modüllerini (menü/API) açar. Frontend'deki plan kataloğu
// (frontend/src/constants/licensePlans.ts) ile içerik olarak senkron tutulmalıdır.
const PLAN_MODULES = {
  Free: ['teachers', 'students', 'classrooms'],
  Standart: [
    'schools', 'teachers', 'students', 'classrooms', 'users', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
  Premium: [
    'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
  Kurumsal: [
    'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
    'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
  ],
};

const ALL_MODULES = [
  'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
  'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
];

// users modülünde oluşturulabilecek maksimum hesap sayısı (platform admin hariç).
// null = sınırsız. Free'de modül kapalıdır (0).
const PLAN_USER_LIMITS = {
  Free: 0,
  Standart: 2,
  Premium: null,
  Kurumsal: null,
};

function resolvePlanKey(planName) {
  if (!planName) return null;
  return Object.keys(PLAN_MODULES).find(
    (name) => name.toLocaleLowerCase('tr-TR') === String(planName).toLocaleLowerCase('tr-TR')
  ) || null;
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

module.exports = {
  PLAN_MODULES,
  ALL_MODULES,
  PLAN_USER_LIMITS,
  getModulesForPlan,
  getUserLimitForPlan,
};
