'use strict';

const { Op } = require('sequelize');
const { Student } = require('../models');

function istanbulTodayParts(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
}

function birthDateToParts(birthDate) {
  if (birthDate == null || birthDate === '') return null;
  if (typeof birthDate === 'string') {
    const match = birthDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  if (birthDate instanceof Date && !Number.isNaN(birthDate.getTime())) {
    return {
      year: birthDate.getUTCFullYear(),
      month: birthDate.getUTCMonth() + 1,
      day: birthDate.getUTCDate(),
    };
  }
  return birthDateToParts(String(birthDate));
}

/**
 * Tam yaş: İstanbul takvim gününe göre, doğum günü henüz gelmediyse bir yıl eksik.
 * Geçersiz veya gelecekteki tarihler için null döner.
 */
function ageFromBirthDate(birthDate, today = new Date()) {
  const birth = birthDateToParts(birthDate);
  if (!birth || birth.month < 1 || birth.month > 12 || birth.day < 1 || birth.day > 31) {
    return null;
  }
  const todayParts = istanbulTodayParts(today);
  let age = todayParts.year - birth.year;
  const birthdayReached =
    todayParts.month > birth.month ||
    (todayParts.month === birth.month && todayParts.day >= birth.day);
  if (!birthdayReached) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function applyAgeFromBirthDate(payload, existingBirthDate) {
  if (!payload) return payload;
  const birthDate = payload.birth_date !== undefined ? payload.birth_date : existingBirthDate;
  if (!birthDate) return payload;
  const age = ageFromBirthDate(birthDate);
  if (age != null) payload.yasi = age;
  return payload;
}

/**
 * Doğum tarihi olan öğrencilerin `yasi` alanını İstanbul gününe göre yeniler.
 * Değişmeyen kayıtlar dokunulmaz.
 */
async function refreshStudentAges(today = new Date()) {
  const students = await Student.findAll({
    where: { birth_date: { [Op.ne]: null } },
    attributes: ['id', 'birth_date', 'yasi'],
  });

  const idsByAge = new Map();
  for (const student of students) {
    const age = ageFromBirthDate(student.birth_date, today);
    if (age == null || student.yasi === age) continue;
    const ids = idsByAge.get(age);
    if (ids) ids.push(student.id);
    else idsByAge.set(age, [student.id]);
  }

  let updated = 0;
  for (const [age, ids] of idsByAge) {
    await Student.update({ yasi: age }, { where: { id: { [Op.in]: ids } } });
    updated += ids.length;
  }

  return { checked: students.length, updated };
}

module.exports = {
  ageFromBirthDate,
  applyAgeFromBirthDate,
  refreshStudentAges,
};
