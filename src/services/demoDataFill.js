'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  School,
  AcademicYear,
  Teacher,
  Classroom,
  Student,
  Subject,
  SubjectClassHour,
  ScheduleEntry,
  DutyLocation,
  DutyAssignment,
  Announcement,
  LeaveRecord,
  StudentAbsence,
  Exam,
  ExamRoom,
  GuidanceSession,
  WorkTask,
  TeacherNote,
  NormPosition,
  AttendanceRecord,
  ExtraLessonEntry,
  ExtraLessonAbsence,
  ParentConsent,
  DisciplineIncident,
  DisciplineParticipant,
  PromotionHistory,
  PersonnelCategory,
  DykCourse,
  DykEnrollment,
  User,
} = require('../models');
const { seedDefaultHolidays } = require('./holidayService');

const STUDENTS_PER_CLASS = 10;
const CLASS_LEVELS = ['9', '10', '11', '12'];
const SECTIONS = ['A', 'B'];

const FIRST_NAMES = {
  K: ['Elif', 'Zeynep', 'Ayşe', 'Fatma', 'Merve', 'Selin', 'Defne', 'Ece', 'İrem', 'Ceren', 'Derya', 'Gizem'],
  E: ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Emre', 'Burak', 'Can', 'Kerem', 'Yusuf', 'Ömer', 'Hakan', 'Eren'],
};
const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Özdemir', 'Arslan', 'Doğan',
  'Kılıç', 'Aslan', 'Çetin', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Acar',
];
const PARENT_FIRST = ['Hatice', 'Emine', 'Fatma', 'Hasan', 'Hüseyin', 'İbrahim', 'Murat', 'Sevim', 'Nurten', 'Kemal'];

const STAFF = [
  { first_name: 'Ayşe', last_name: 'Yılmaz', brans: 'Matematik', employment_type: 'kadrolu', kariyer: 'Uzman Öğretmen' },
  { first_name: 'Mehmet', last_name: 'Kaya', brans: 'Fizik', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Fatma', last_name: 'Demir', brans: 'Kimya', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Ali', last_name: 'Şahin', brans: 'Biyoloji', employment_type: 'sozlesmeli', kariyer: 'Öğretmen' },
  { first_name: 'Zeynep', last_name: 'Çelik', brans: 'Türk Dili ve Edebiyatı', employment_type: 'kadrolu', kariyer: 'Başöğretmen' },
  { first_name: 'Mustafa', last_name: 'Yıldız', brans: 'Tarih', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Elif', last_name: 'Aydın', brans: 'Coğrafya', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Ece', last_name: 'Acar', brans: 'İngilizce', employment_type: 'ucretli', kariyer: 'Öğretmen' },
  { first_name: 'Hakan', last_name: 'Koç', brans: 'Din Kültürü', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Cem', last_name: 'Kurt', brans: 'Beden Eğitimi', employment_type: 'kadrolu', kariyer: 'Öğretmen' },
  { first_name: 'Selin', last_name: 'Arslan', brans: 'Rehberlik', employment_type: 'kadrolu', kariyer: 'Uzman Öğretmen' },
  { first_name: 'Burak', last_name: 'Polat', brans: 'Görsel Sanatlar', employment_type: 'kadrolu', kariyer: 'Öğretmen', duty_assignment_type: 'ders_tamamlama', working_institution: 'Atatürk Anadolu Lisesi' },
];

const SUBJECTS = [
  { name: 'Matematik', code: 'MAT', hours: 6, brans: 'Matematik' },
  { name: 'Fizik', code: 'FIZ', hours: 2, brans: 'Fizik' },
  { name: 'Kimya', code: 'KIM', hours: 2, brans: 'Kimya' },
  { name: 'Biyoloji', code: 'BIY', hours: 2, brans: 'Biyoloji' },
  { name: 'Türk Dili ve Edebiyatı', code: 'TDE', hours: 5, brans: 'Türk Dili ve Edebiyatı' },
  { name: 'Tarih', code: 'TAR', hours: 2, brans: 'Tarih' },
  { name: 'Coğrafya', code: 'COG', hours: 2, brans: 'Coğrafya' },
  { name: 'İngilizce', code: 'ING', hours: 4, brans: 'İngilizce' },
  { name: 'Din Kültürü ve Ahlak Bilgisi', code: 'DIN', hours: 2, brans: 'Din Kültürü' },
  { name: 'Beden Eğitimi', code: 'BED', hours: 2, brans: 'Beden Eğitimi' },
  { name: 'Rehberlik', code: 'REH', hours: 1, brans: 'Rehberlik', is_guidance: true },
  { name: 'Görsel Sanatlar', code: 'GOR', hours: 1, brans: 'Görsel Sanatlar' },
];

const DUTY_PLACES = [
  { name: 'Bahçe kapısı', floor_level: 0, sort_order: 1 },
  { name: 'Zemin kat', floor_level: 0, sort_order: 2 },
  { name: '1. kat', floor_level: 1, sort_order: 3 },
  { name: '2. kat', floor_level: 2, sort_order: 4 },
];

const CATEGORIES = [
  { name: 'Memur', code: 'memur', sort_order: 10 },
  { name: 'İşçi', code: 'isci', sort_order: 20 },
  { name: 'TYP Personeli', code: 'typ', sort_order: 30 },
];

function pushCount(list, count, label) {
  if (count > 0) list.push(`${count} ${label}`);
}

function istanbulToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addIsoDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function academicYearOf(iso) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 9 ? y : y - 1;
  return {
    label: `${start}-${start + 1}`,
    start_date: `${start}-09-07`,
    end_date: `${start + 1}-06-12`,
  };
}

function recentWeekdays(iso, count, direction) {
  const days = [];
  let cursor = iso;
  while (days.length < count) {
    const w = weekday(cursor);
    if (w <= 5) days.push(cursor);
    cursor = addIsoDays(cursor, direction);
  }
  return days;
}

function tcknFrom(n) {
  const base = String(100000000 + (n % 800000000)).padStart(9, '0').slice(0, 9);
  const d = base.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  let d10 = (odd * 7 - even) % 10;
  if (d10 < 0) d10 += 10;
  const d11 = (d.reduce((sum, item) => sum + item, 0) + d10) % 10;
  return `${base}${d10}${d11}`;
}

function nextTckn(used) {
  let n = 100000 + used.size * 17;
  let value = tcknFrom(n);
  while (used.has(value)) {
    n += 1;
    value = tcknFrom(n);
  }
  used.add(value);
  return value;
}

function phoneFrom(n) {
  return `0532${String(1000000 + (n % 9000000)).slice(0, 7)}`;
}

function slugMail(first, last, n) {
  const map = { ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i' };
  const raw = `${first}.${last}.${n}`.toLocaleLowerCase('tr-TR');
  const slug = raw.replace(/[ğüşıöçâî]/g, (ch) => map[ch] || ch).replace(/[^a-z0-9.]+/g, '');
  return `${slug}@demo.okul`;
}

function ageInYears(birth, today) {
  const [ty, tm, td] = today.split('-').map(Number);
  const [by, bm, bd] = birth.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

async function ensureSchool(tenantId, transaction, added) {
  let school = await School.findOne({
    where: { tenant_id: tenantId },
    order: [['id', 'ASC']],
    transaction,
  });
  if (!school) {
    let code = '100001';
    const taken = await School.findOne({ where: { code }, transaction });
    if (taken) {
      code = String(100000 + (tenantId % 900000)).padStart(6, '0');
    }
    school = await School.create(
      {
        tenant_id: tenantId,
        name: 'Demo Anadolu Lisesi',
        code,
        school_type: 'lise',
        program_type: 'anadolu_lisesi',
        principal_name: 'Demo Okul Müdürü',
        daily_period_count: 8,
      },
      { transaction }
    );
    pushCount(added, 1, 'okul');
    return school;
  }

  const patch = {};
  if (!school.program_type) patch.program_type = 'anadolu_lisesi';
  if (!school.principal_name) patch.principal_name = 'Demo Okul Müdürü';
  if (!school.daily_period_count) patch.daily_period_count = 8;
  if (Object.keys(patch).length) {
    await school.update(patch, { transaction });
    pushCount(added, 1, 'okul bilgisi');
  }
  return school;
}

async function ensureAcademicYear(tenantId, today, transaction, added) {
  const spec = academicYearOf(today);
  let current = await AcademicYear.findOne({
    where: { tenant_id: tenantId, is_current: true },
    transaction,
  });
  if (current) return current;

  current = await AcademicYear.findOne({
    where: { tenant_id: tenantId, label: spec.label },
    transaction,
  });
  if (!current) {
    current = await AcademicYear.create(
      { tenant_id: tenantId, ...spec, is_current: true },
      { transaction }
    );
    pushCount(added, 1, 'eğitim öğretim yılı');
    return current;
  }
  await current.update({ is_current: true }, { transaction });
  pushCount(added, 1, 'eğitim öğretim yılı');
  return current;
}

async function ensureCategories(tenantId, transaction, added) {
  const existing = await PersonnelCategory.findAll({ where: { tenant_id: tenantId }, transaction });
  const have = new Set(existing.map((row) => row.code).filter(Boolean));
  const missing = CATEGORIES.filter((row) => !have.has(row.code));
  if (!missing.length) return;
  await PersonnelCategory.bulkCreate(
    missing.map((row) => ({ tenant_id: tenantId, ...row })),
    { transaction }
  );
  pushCount(added, missing.length, 'personel kategorisi');
}

async function ensureTeachers(tenantId, school, usedIds, transaction, added) {
  const existing = await Teacher.findAll({ where: { tenant_id: tenantId }, transaction });
  existing.forEach((row) => {
    if (row.national_id) usedIds.add(row.national_id);
  });
  const have = new Set(existing.map((row) => `${row.first_name}|${row.last_name}`));
  const need = Math.max(0, 12 - existing.length);
  const picks = STAFF.filter((row) => !have.has(`${row.first_name}|${row.last_name}`)).slice(0, need);
  if (!picks.length) return existing;

  const rows = picks.map((row, index) => {
    const birth = `198${index % 10}-0${(index % 9) + 1}-15`;
    return {
      tenant_id: tenantId,
      school_id: school.id,
      first_name: row.first_name,
      last_name: row.last_name,
      brans: row.brans,
      title_branch: row.brans,
      unvan: 'Öğretmen',
      kariyer: row.kariyer,
      employment_type: row.employment_type,
      personnel_type: 'ogretmen',
      duty_assignment_type: row.duty_assignment_type || null,
      working_institution: row.working_institution || school.name,
      national_id: nextTckn(usedIds),
      personnel_no: `D${10001 + existing.length + index}`,
      phone: phoneFrom(2000 + existing.length + index),
      email: slugMail(row.first_name, row.last_name, existing.length + index),
      city: 'Ankara',
      district: 'Çankaya',
      degree: index % 5 === 0 ? '2' : '3',
      rank: String((index % 3) + 1),
      degree_rank_date: '2025-09-01',
      service_start_date: `${2010 + (index % 8)}-09-15`,
      first_duty_date: `${2010 + (index % 8)}-09-15`,
      annual_leave_quota: 30,
      birth_date: birth,
    };
  });
  const created = await Teacher.bulkCreate(rows, { transaction });
  pushCount(added, created.length, 'öğretmen');
  return existing.concat(created);
}

async function ensureClassrooms(tenantId, school, yearLabel, teachers, transaction, added) {
  const existing = await Classroom.findAll({ where: { tenant_id: tenantId, school_id: school.id }, transaction });
  const current = existing.filter((row) => !row.academic_year || row.academic_year === yearLabel);
  const keys = new Set(current.map((row) => `${row.class_level}|${row.section}`));
  const missing = [];
  for (const level of CLASS_LEVELS) {
    for (const section of SECTIONS) {
      if (!keys.has(`${level}|${section}`)) {
        missing.push({
          tenant_id: tenantId,
          school_id: school.id,
          class_level: level,
          section,
          academic_year: yearLabel,
          is_active: true,
        });
      }
    }
  }
  let created = [];
  if (missing.length) {
    created = await Classroom.bulkCreate(missing, { transaction });
    pushCount(added, created.length, 'sınıf');
  }

  const rooms = current.concat(created);
  const pool = teachers.filter((row) => row.personnel_type !== 'memur');
  let assigned = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    if (!rooms[i].teacher_id && pool.length) {
      await rooms[i].update({ teacher_id: pool[i % pool.length].id }, { transaction });
      assigned += 1;
    }
  }
  pushCount(added, assigned, 'sınıf öğretmeni');
  return rooms;
}

async function ensureStudents(tenantId, school, rooms, today, usedIds, transaction, added) {
  const existing = await Student.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id', 'classroom_id', 'student_number', 'national_id'],
    transaction,
  });
  existing.forEach((row) => {
    if (row.national_id) usedIds.add(String(row.national_id));
  });
  const numbers = new Set(existing.map((row) => String(row.student_number || '')));
  let serial = 1001;
  const nextNumber = () => {
    while (numbers.has(String(serial))) serial += 1;
    const value = String(serial);
    numbers.add(value);
    serial += 1;
    return value;
  };
  const perClass = new Map();
  existing.forEach((row) => {
    perClass.set(row.classroom_id, (perClass.get(row.classroom_id) || 0) + 1);
  });

  const rows = [];
  let nameIndex = existing.length;
  for (const room of rooms) {
    const have = perClass.get(room.id) || 0;
    if (have >= 8) continue;
    const target = STUDENTS_PER_CLASS;
    for (let i = have; i < target; i += 1) {
      const gender = nameIndex % 2 === 0 ? 'K' : 'E';
      const names = FIRST_NAMES[gender];
      const first = names[nameIndex % names.length];
      const levelNum = Number(room.class_level);
      const yearsOld = Number.isFinite(levelNum) ? 14 + levelNum - 8 : 16;
      const last = LAST_NAMES[(nameIndex + (Number.isFinite(levelNum) ? levelNum : 0)) % LAST_NAMES.length];
      const birthYear = Number(today.slice(0, 4)) - yearsOld;
      const birth = `${birthYear}-${String((nameIndex % 12) + 1).padStart(2, '0')}-${String((nameIndex % 27) + 1).padStart(2, '0')}`;
      const father = PARENT_FIRST[(nameIndex + 3) % PARENT_FIRST.length];
      const mother = PARENT_FIRST[nameIndex % PARENT_FIRST.length];
      rows.push({
        tenant_id: tenantId,
        school_id: school.id,
        classroom_id: room.id,
        student_number: nextNumber(),
        national_id: nextTckn(usedIds),
        first_name: first,
        last_name: last,
        class_level: room.class_level,
        section: room.section,
        gender,
        birth_date: birth,
        yasi: ageInYears(birth, today),
        registration_status: 'aktif',
        parent_name: `${father} ${last}`,
        mother_name: mother,
        father_name: father,
        parent_phone: phoneFrom(4000 + nameIndex),
        student_phone: nameIndex % 4 === 0 ? phoneFrom(7000 + nameIndex) : null,
        boarding_status: nameIndex % 11 === 0 ? 'Yatılı' : 'Gündüzlü',
        is_inclusion: nameIndex % 17 === 0,
        is_foreign: nameIndex % 23 === 0,
        extra_contacts: [],
      });
      nameIndex += 1;
    }
  }
  if (!rows.length) return;
  await Student.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'öğrenci');
}

async function ensureSubjects(tenantId, transaction, added) {
  const existing = await Subject.findAll({ where: { tenant_id: tenantId }, transaction });
  if (existing.length >= 8) return existing;
  const have = new Set(existing.map((row) => row.name));
  const missing = SUBJECTS.filter((row) => !have.has(row.name)).slice(0, Math.max(0, 12 - existing.length));
  if (!missing.length) return existing;
  const created = await Subject.bulkCreate(
    missing.map((row) => ({
      tenant_id: tenantId,
      name: row.name,
      code: row.code,
      difficulty_level: 'orta',
      course_kind: 'kultur',
      is_guidance: Boolean(row.is_guidance),
      is_active: true,
    })),
    { transaction }
  );
  pushCount(added, created.length, 'ders');
  return existing.concat(created);
}

async function ensureSubjectHours(tenantId, subjects, transaction, added) {
  const count = await SubjectClassHour.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 10) return;
  const existing = await SubjectClassHour.findAll({
    where: { tenant_id: tenantId },
    attributes: ['subject_id'],
    transaction,
  });
  const covered = new Set(existing.map((row) => row.subject_id));
  const hoursByName = new Map(SUBJECTS.map((row) => [row.name, row.hours]));
  const rows = [];
  for (const subject of subjects) {
    if (covered.has(subject.id)) continue;
    const hours = hoursByName.get(subject.name) || 2;
    for (const level of CLASS_LEVELS) {
      rows.push({
        tenant_id: tenantId,
        subject_id: subject.id,
        class_level: level,
        weekly_hours: hours,
      });
    }
  }
  if (!rows.length) return;
  await SubjectClassHour.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'haftalık ders saati');
}

async function ensureSchedule(tenantId, school, rooms, subjects, teachers, yearLabel, transaction, added) {
  if (!rooms.length || !subjects.length || !teachers.length) return;

  const existing = await ScheduleEntry.findAll({
    where: { tenant_id: tenantId },
    attributes: ['classroom_id', 'teacher_id', 'day_of_week', 'period_no', 'academic_year'],
    transaction,
  });
  const classSlots = new Set(
    existing.map((row) => `${row.classroom_id}|${row.day_of_week}|${row.period_no}|${row.academic_year || ''}`)
  );
  const teacherSlots = new Set(
    existing
      .filter((row) => row.teacher_id)
      .map((row) => `${row.teacher_id}|${row.day_of_week}|${row.period_no}|${row.academic_year || ''}`)
  );

  const byBranch = new Map();
  teachers.forEach((teacher) => {
    if (teacher.brans) byBranch.set(teacher.brans, teacher);
  });
  let rotation = SUBJECTS.map((spec) => {
    const subject = subjects.find((row) => row.name === spec.name);
    const teacher = byBranch.get(spec.brans) || teachers[0];
    return subject && teacher ? { subject, teacher } : null;
  }).filter(Boolean);
  if (rotation.length < 2) {
    rotation = subjects.slice(0, 12).map((subject, index) => ({
      subject,
      teacher: teachers[index % teachers.length],
    }));
  }
  if (rotation.length < 2) return;

  const slotsByRoom = new Map();
  existing.forEach((row) => {
    if ((row.academic_year || '') !== yearLabel && row.academic_year) return;
    slotsByRoom.set(row.classroom_id, (slotsByRoom.get(row.classroom_id) || 0) + 1);
  });

  const rows = [];
  rooms.forEach((room, roomIndex) => {
    if ((slotsByRoom.get(room.id) || 0) >= 10) return;
    for (let day = 1; day <= 5; day += 1) {
      for (let period = 1; period <= 6; period += 1) {
        const pick = rotation[(roomIndex + day + period) % rotation.length];
        const classKey = `${room.id}|${day}|${period}|${yearLabel}`;
        const teacherKey = `${pick.teacher.id}|${day}|${period}|${yearLabel}`;
        if (classSlots.has(classKey) || teacherSlots.has(teacherKey)) continue;
        classSlots.add(classKey);
        teacherSlots.add(teacherKey);
        rows.push({
          tenant_id: tenantId,
          school_id: school.id,
          classroom_id: room.id,
          subject_id: pick.subject.id,
          teacher_id: pick.teacher.id,
          day_of_week: day,
          period_no: period,
          academic_year: yearLabel,
          co_teacher_ids: [],
        });
      }
    }
  });
  if (!rows.length) return;
  await ScheduleEntry.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'ders programı kaydı');
}

async function ensureDuty(tenantId, school, teachers, today, transaction, added) {
  const places = await DutyLocation.findAll({ where: { tenant_id: tenantId, school_id: school.id }, transaction });
  const placeNames = new Set(places.map((row) => row.name));
  const missingPlaces = DUTY_PLACES.filter((row) => !placeNames.has(row.name));
  let locations = places;
  if (places.length < 3 && missingPlaces.length) {
    const created = await DutyLocation.bulkCreate(
      missingPlaces.map((row) => ({
        tenant_id: tenantId,
        school_id: school.id,
        ...row,
        is_active: true,
      })),
      { transaction }
    );
    locations = places.concat(created);
    pushCount(added, created.length, 'nöbet yeri');
  }

  if (!locations.length || !teachers.length) return;
  const coveredLocations = new Set(
    (await DutyAssignment.findAll({
      where: { tenant_id: tenantId },
      attributes: ['duty_location_id'],
      transaction,
    })).map((row) => row.duty_location_id)
  );
  const openLocations = locations.filter((place) => !coveredLocations.has(place.id));
  if (!openLocations.length) return;
  const existing = await DutyAssignment.findAll({
    where: { tenant_id: tenantId },
    attributes: ['teacher_id', 'duty_date'],
    transaction,
  });
  const taken = new Set(existing.map((row) => `${row.teacher_id}|${row.duty_date}`));
  const days = recentWeekdays(today, 10, 1);
  const rows = [];
  days.forEach((day, dayIndex) => {
    openLocations.forEach((place, placeIndex) => {
      const teacher = teachers[(dayIndex * openLocations.length + placeIndex) % teachers.length];
      const key = `${teacher.id}|${day}`;
      if (taken.has(key)) return;
      taken.add(key);
      rows.push({
        tenant_id: tenantId,
        school_id: school.id,
        teacher_id: teacher.id,
        duty_location_id: place.id,
        duty_date: day,
        notes: 'Demo nöbet görevi',
      });
    });
  });
  if (!rows.length) return;
  await DutyAssignment.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'nöbet');
}

async function ensureAnnouncements(tenantId, admin, transaction, added) {
  const count = await Announcement.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 2) return;
  const samples = [
    {
      title: 'Veli toplantısı',
      body: '9 ve 10. sınıfların veli toplantısı cuma günü saat 14.00’te konferans salonundadır.',
    },
    {
      title: 'Deneme sınavı',
      body: 'Okul geneli deneme sınavı önümüzdeki salı ilk iki ders saatinde uygulanacaktır.',
    },
  ].slice(0, 2 - count);
  await Announcement.bulkCreate(
    samples.map((row) => ({
      tenant_id: tenantId,
      created_by: admin ? admin.id : null,
      title: row.title,
      body: row.body,
      channel: 'sms',
      target_type: 'all',
      target_ids: [],
      recipient_count: 0,
      status: 'gonderildi',
      sent_at: new Date(),
    })),
    { transaction }
  );
  pushCount(added, samples.length, 'duyuru');
}

async function ensureLeaves(tenantId, teachers, today, transaction, added) {
  const count = await LeaveRecord.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 2 || teachers.length < 2) return;
  const start = addIsoDays(today, -1);
  const end = addIsoDays(today, 1);
  const rows = [
    { teacher: teachers[0], leave_type: 'yillik', reason: 'Yıllık izin' },
    { teacher: teachers[1], leave_type: 'mazeret', reason: 'Ailevi mazeret' },
  ].slice(0, 2 - count);
  await LeaveRecord.bulkCreate(
    rows.map((row) => ({
      tenant_id: tenantId,
      teacher_id: row.teacher.id,
      leave_type: row.leave_type,
      start_date: start,
      end_date: end,
      day_count: 3,
      reason: row.reason,
    })),
    { transaction }
  );
  pushCount(added, rows.length, 'izin');
}

async function ensureAbsences(tenantId, today, transaction, added) {
  const count = await StudentAbsence.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 8) return;
  const students = await Student.findAll({
    where: { tenant_id: tenantId, registration_status: 'aktif' },
    attributes: ['id'],
    limit: 12,
    order: [['id', 'ASC']],
    transaction,
  });
  if (!students.length) return;
  const days = recentWeekdays(addIsoDays(today, -1), 6, -1);
  const existing = await StudentAbsence.findAll({
    where: { tenant_id: tenantId },
    attributes: ['student_id', 'absence_date'],
    transaction,
  });
  const taken = new Set(existing.map((row) => `${row.student_id}|${row.absence_date}`));
  const types = ['mazeretsiz', 'mazeretli', 'raporlu'];
  const rows = [];
  students.forEach((student, index) => {
    if (rows.length >= 12 - count) return;
    const day = days[index % days.length];
    const key = `${student.id}|${day}`;
    if (taken.has(key)) return;
    taken.add(key);
    rows.push({
      tenant_id: tenantId,
      student_id: student.id,
      absence_date: day,
      absence_type: types[index % types.length],
      reason: index % 3 === 0 ? 'Sağlık' : null,
    });
  });
  if (!rows.length) return;
  await StudentAbsence.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'öğrenci devamsızlığı');
}

async function ensureExams(tenantId, school, rooms, subjects, teachers, today, transaction, added) {
  const roomCount = await ExamRoom.count({ where: { tenant_id: tenantId }, transaction });
  if (roomCount < 3) {
    const created = await ExamRoom.bulkCreate(
      [
        { name: 'A-101', building: 'A Blok', floor: '1', capacity: 30 },
        { name: 'A-102', building: 'A Blok', floor: '1', capacity: 30 },
        { name: 'B-201', building: 'B Blok', floor: '2', capacity: 24 },
        { name: 'Konferans salonu', building: 'Ana bina', floor: 'Zemin', capacity: 80 },
      ].slice(0, 4 - roomCount).map((row) => ({
        tenant_id: tenantId,
        school_id: school.id,
        is_active: true,
        ...row,
      })),
      { transaction }
    );
    pushCount(added, created.length, 'sınav salonu');
  }

  const examCount = await Exam.count({ where: { tenant_id: tenantId }, transaction });
  if (examCount >= 3 || !rooms.length || !subjects.length) return;
  const rows = [];
  for (let i = 0; i < 4 - examCount && i < rooms.length; i += 1) {
    const subject = subjects[i % subjects.length];
    const teacher = teachers[i % teachers.length];
    rows.push({
      tenant_id: tenantId,
      school_id: school.id,
      classroom_id: rooms[i].id,
      subject_id: subject.id,
      teacher_id: teacher ? teacher.id : null,
      exam_type: 'yazili',
      exam_date: addIsoDays(today, 3 + i * 2),
      start_time: '09:00',
      duration_minutes: 40,
      notes: '1. yazılı',
    });
  }
  if (!rows.length) return;
  await Exam.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'sınav');
}

async function ensureGuidance(tenantId, admin, today, transaction, added) {
  const count = await GuidanceSession.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 2) return;
  const students = await Student.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id'],
    limit: 3,
    order: [['id', 'ASC']],
    transaction,
  });
  if (!students.length) return;
  const types = ['bireysel', 'veli_gorusmesi', 'yonlendirme'];
  const summaries = [
    'Ders çalışma planı üzerine görüşüldü.',
    'Devam durumu veli ile paylaşıldı.',
    'Alan seçimi için yönlendirme yapıldı.',
  ];
  const rows = students.slice(0, 3 - count).map((student, index) => ({
    tenant_id: tenantId,
    student_id: student.id,
    created_by: admin ? admin.id : null,
    session_date: addIsoDays(today, -index),
    session_type: types[index],
    summary: summaries[index],
    referral_to: index === 2 ? 'RAM' : null,
  }));
  await GuidanceSession.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'rehberlik görüşmesi');
}

async function ensureWorkTasks(tenantId, admin, today, transaction, added) {
  if (!admin) return;
  const count = await WorkTask.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 2) return;
  const samples = [
    { title: 'Aylık devamsızlık listesini kontrol et', description: 'Şube öğretmenlerinden gelen listeleri birleştir.' },
    { title: 'Nöbet çizelgesini panoya as', description: 'Gelecek haftanın nöbet listesini öğretmenler odasına bırak.' },
  ].slice(0, 2 - count);
  await WorkTask.bulkCreate(
    samples.map((row, index) => ({
      tenant_id: tenantId,
      title: row.title,
      description: row.description,
      assignee_user_id: admin.id,
      created_by: admin.id,
      frequency: 'once',
      next_due_at: new Date(`${addIsoDays(today, index + 1)}T09:00:00+03:00`),
      remind_before_minutes: 1440,
      is_mandatory: index === 0,
      notify_channels: [],
      status: 'active',
    })),
    { transaction }
  );
  pushCount(added, samples.length, 'iş');
}

async function ensureNotes(tenantId, school, admin, transaction, added) {
  if (!admin) return;
  const count = await TeacherNote.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 3) return;
  const students = await Student.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id'],
    limit: 4,
    order: [['id', 'ASC']],
    transaction,
  });
  const notes = [
    { tags: ['akademik'], note: 'Matematik dersinde katılımı arttı.' },
    { tags: ['devam'], note: 'Bu hafta iki kez geç geldi.' },
    { tags: ['sosyal'], note: 'Grup çalışmalarında sorumluluk alıyor.' },
    { tags: ['veli'], note: 'Veli görüşmesi planlandı.' },
  ];
  const rows = students.slice(0, 4 - count).map((student, index) => ({
    tenant_id: tenantId,
    school_id: school.id,
    student_id: student.id,
    teacher_id: admin.id,
    tags: notes[index].tags,
    note: notes[index].note,
  }));
  if (!rows.length) return;
  await TeacherNote.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'öğretmen notu');
}

async function ensureNorms(tenantId, school, transaction, added) {
  const count = await NormPosition.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 4) return;
  const have = new Set(
    (await NormPosition.findAll({
      where: { tenant_id: tenantId },
      attributes: ['title_branch'],
      transaction,
    })).map((row) => row.title_branch)
  );
  const branches = ['Matematik', 'Türk Dili ve Edebiyatı', 'İngilizce', 'Fizik', 'Rehberlik', 'Beden Eğitimi'];
  const missing = branches.filter((name) => !have.has(name)).slice(0, Math.max(0, 6 - count));
  if (!missing.length) return;
  await NormPosition.bulkCreate(
    missing.map((title) => ({
      tenant_id: tenantId,
      school_id: school.id,
      title_branch: title,
      quota_count: title === 'Matematik' || title === 'Türk Dili ve Edebiyatı' ? 3 : 2,
      notes: 'Demo norm kadro',
    })),
    { transaction }
  );
  pushCount(added, missing.length, 'norm kadro');
}

async function ensureAttendance(tenantId, teachers, today, transaction, added) {
  const count = await AttendanceRecord.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 8 || !teachers.length) return;
  const days = recentWeekdays(addIsoDays(today, -1), 3, -1);
  const existing = await AttendanceRecord.findAll({
    where: { tenant_id: tenantId },
    attributes: ['teacher_id', 'attendance_date'],
    transaction,
  });
  const taken = new Set(existing.map((row) => `${row.teacher_id}|${row.attendance_date}`));
  const rows = [];
  for (const day of days) {
    teachers.forEach((teacher, index) => {
      const key = `${teacher.id}|${day}`;
      if (taken.has(key)) return;
      taken.add(key);
      rows.push({
        tenant_id: tenantId,
        teacher_id: teacher.id,
        attendance_date: day,
        status: index === 0 && day === days[0] ? 'izinli' : 'geldi',
        overtime_hours: null,
        notes: null,
      });
    });
  }
  if (!rows.length) return;
  await AttendanceRecord.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'puantaj kaydı');
}

async function ensureExtraLessons(tenantId, teachers, today, transaction, added) {
  const count = await ExtraLessonEntry.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 4 || !teachers.length) return;
  const [year, month] = today.split('-').map(Number);
  const paid = teachers.find((row) => row.employment_type === 'ucretli') || teachers[0];
  const assigned = teachers.find((row) => row.duty_assignment_type) || teachers[1] || teachers[0];
  const rows = [
    { teacher_id: paid.id, category: 'ders_yuku', hours: 18, notes: 'Ücretli ders yükü' },
    { teacher_id: paid.id, category: 'hazirlik_planlama', hours: 2, notes: 'YEP' },
    { teacher_id: assigned.id, category: 'ders_yuku', hours: 8, notes: 'Görevlendirme ek ders' },
    { teacher_id: teachers[0].id, category: 'nobet', hours: 6, notes: 'Nöbet' },
  ].slice(0, 4 - count);
  await ExtraLessonEntry.bulkCreate(
    rows.map((row) => ({
      tenant_id: tenantId,
      teacher_id: row.teacher_id,
      year,
      month,
      category: row.category,
      hours: row.hours,
      notes: row.notes,
    })),
    { transaction }
  );
  pushCount(added, rows.length, 'ek ders');

  const absenceCount = await ExtraLessonAbsence.count({ where: { tenant_id: tenantId }, transaction });
  if (absenceCount >= 1) return;
  const day = recentWeekdays(addIsoDays(today, -1), 1, -1)[0];
  const clash = await ExtraLessonAbsence.findOne({
    where: { tenant_id: tenantId, teacher_id: paid.id, absence_date: day },
    transaction,
  });
  if (clash) return;
  await ExtraLessonAbsence.create(
    {
      tenant_id: tenantId,
      teacher_id: paid.id,
      absence_date: day,
      reason: 'rapor',
      missed_hours: 4,
      note: 'Raporlu olduğu için ders yapılmadı',
    },
    { transaction }
  );
  pushCount(added, 1, 'ek ders devamsızlığı');
}

async function ensureConsents(tenantId, transaction, added) {
  const count = await ParentConsent.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 4) return;
  const students = await Student.findAll({
    where: { tenant_id: tenantId },
    attributes: ['id'],
    limit: 6,
    order: [['id', 'ASC']],
    transaction,
  });
  if (!students.length) return;
  const existing = await ParentConsent.findAll({
    where: { tenant_id: tenantId },
    attributes: ['student_id', 'consent_type'],
    transaction,
  });
  const taken = new Set(existing.map((row) => `${row.student_id}|${row.consent_type}`));
  const types = ['sms_bilgilendirme', 'fotograf_kullanim'];
  const rows = [];
  students.forEach((student) => {
    types.forEach((type) => {
      const key = `${student.id}|${type}`;
      if (taken.has(key) || rows.length >= 8 - count) return;
      taken.add(key);
      rows.push({
        tenant_id: tenantId,
        student_id: student.id,
        consent_type: type,
        granted: true,
        granted_at: new Date(),
        notes: 'Demo veli izni',
      });
    });
  });
  if (!rows.length) return;
  await ParentConsent.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'veli izni');
}

async function ensureDiscipline(tenantId, school, admin, yearLabel, today, transaction, added) {
  const count = await DisciplineIncident.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 1) return;
  const student = await Student.findOne({
    where: { tenant_id: tenantId },
    order: [['id', 'ASC']],
    transaction,
  });
  if (!student) return;
  const incident = await DisciplineIncident.create(
    {
      tenant_id: tenantId,
      school_id: school.id,
      incident_code: `DEMO-${yearLabel}-001`,
      academic_year: yearLabel,
      title: 'Teneffüste tartışma',
      incident_date: addIsoDays(today, -3),
      incident_time: '10:40',
      location: 'Bahçe',
      summary: 'İki öğrenci arasında sözlü tartışma yaşandı. Şube öğretmeni tutanak tuttu.',
      complainant_name: 'Nöbetçi öğretmen',
      status: 'inceleniyor',
      created_by: admin ? admin.id : null,
    },
    { transaction }
  );
  await DisciplineParticipant.create(
    {
      incident_id: incident.id,
      student_id: student.id,
      role: 'suclanan',
      status: 'ifade_bekleniyor',
    },
    { transaction }
  );
  pushCount(added, 1, 'disiplin olayı');
}

async function ensurePromotions(tenantId, teachers, transaction, added) {
  const count = await PromotionHistory.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 2 || !teachers.length) return;
  const pool = teachers.filter((row) => row.employment_type === 'kadrolu').slice(0, 2);
  if (!pool.length) return;
  const rows = pool.slice(0, 2 - count).map((teacher) => ({
    tenant_id: tenantId,
    teacher_id: teacher.id,
    previous_degree: '4',
    previous_rank: '3',
    previous_degree_rank_date: '2024-09-01',
    new_degree: '4',
    new_rank: '2',
    new_degree_rank_date: '2025-09-01',
    note: 'Yıllık kademe ilerlemesi',
    type: 'yillik',
    is_permanent: true,
  }));
  if (!rows.length) return;
  await PromotionHistory.bulkCreate(rows, { transaction });
  pushCount(added, rows.length, 'terfi kaydı');
}

async function ensureDyk(tenantId, school, subjects, teachers, yearLabel, transaction, added) {
  const count = await DykCourse.count({ where: { tenant_id: tenantId }, transaction });
  if (count >= 1 || !subjects.length || !teachers.length) return;
  const math = subjects.find((row) => row.name === 'Matematik') || subjects[0];
  const english = subjects.find((row) => row.name === 'İngilizce') || subjects[0];
  const mathTeacher = teachers.find((row) => row.brans === 'Matematik') || teachers[0];
  const englishTeacher = teachers.find((row) => row.brans === 'İngilizce') || teachers[0];
  const courses = await DykCourse.bulkCreate(
    [
      {
        tenant_id: tenantId,
        school_id: school.id,
        subject_id: math.id,
        teacher_id: mathTeacher.id,
        name: '9. sınıf matematik DYK',
        academic_year: yearLabel,
        min_attendance_rate: 80,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        school_id: school.id,
        subject_id: english.id,
        teacher_id: englishTeacher.id,
        name: '10. sınıf İngilizce DYK',
        academic_year: yearLabel,
        min_attendance_rate: 80,
        is_active: true,
      },
    ],
    { transaction }
  );
  pushCount(added, courses.length, 'DYK kursu');

  const students = await Student.findAll({
    where: { tenant_id: tenantId, class_level: { [Op.in]: ['9', '10'] } },
    attributes: ['id', 'class_level'],
    limit: 16,
    order: [['id', 'ASC']],
    transaction,
  });
  const enrollments = [];
  students.forEach((student) => {
    const course = student.class_level === '10' ? courses[1] : courses[0];
    enrollments.push({
      tenant_id: tenantId,
      dyk_course_id: course.id,
      student_id: student.id,
    });
  });
  if (enrollments.length) {
    await DykEnrollment.bulkCreate(enrollments, { transaction });
    pushCount(added, enrollments.length, 'DYK kaydı');
  }
}

async function fillMissingDemoData(tenantId) {
  return sequelize.transaction(async (transaction) => {
    const added = [];
    const today = istanbulToday();
    const year = await ensureAcademicYear(tenantId, today, transaction, added);
    const school = await ensureSchool(tenantId, transaction, added);
    const holidayRows = await seedDefaultHolidays(tenantId, { transaction });
    pushCount(added, holidayRows.length, 'resmi tatil');
    await ensureCategories(tenantId, transaction, added);

    const usedIds = new Set();
    const teachers = await ensureTeachers(tenantId, school, usedIds, transaction, added);
    const rooms = await ensureClassrooms(tenantId, school, year.label, teachers, transaction, added);
    await ensureStudents(tenantId, school, rooms, today, usedIds, transaction, added);
    const subjects = await ensureSubjects(tenantId, transaction, added);
    await ensureSubjectHours(tenantId, subjects, transaction, added);
    await ensureSchedule(tenantId, school, rooms, subjects, teachers, year.label, transaction, added);
    await ensureDuty(tenantId, school, teachers, today, transaction, added);

    const admin = await User.findOne({
      where: { tenant_id: tenantId },
      order: [['id', 'ASC']],
      transaction,
    });
    await ensureAnnouncements(tenantId, admin, transaction, added);
    await ensureLeaves(tenantId, teachers, today, transaction, added);
    await ensureAbsences(tenantId, today, transaction, added);
    await ensureExams(tenantId, school, rooms, subjects, teachers, today, transaction, added);
    await ensureGuidance(tenantId, admin, today, transaction, added);
    await ensureWorkTasks(tenantId, admin, today, transaction, added);
    await ensureNotes(tenantId, school, admin, transaction, added);
    await ensureNorms(tenantId, school, transaction, added);
    await ensureAttendance(tenantId, teachers, today, transaction, added);
    await ensureExtraLessons(tenantId, teachers, today, transaction, added);
    await ensureConsents(tenantId, transaction, added);
    await ensureDiscipline(tenantId, school, admin, year.label, today, transaction, added);
    await ensurePromotions(tenantId, teachers, transaction, added);
    await ensureDyk(tenantId, school, subjects, teachers, year.label, transaction, added);
    return added;
  });
}

module.exports = { fillMissingDemoData };
