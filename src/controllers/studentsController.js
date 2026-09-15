'use strict';

const { Student, Classroom } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');
const {
  IMPORTABLE_FIELDS,
  previewWorkbook,
  getMappedRows,
  parseClassSection,
} = require('../services/excelImportService');

const COLUMN_LABELS = {
  student_number: 'Öğrenci No',
  national_id: 'T.C. Kimlik No',
  first_name: 'Ad',
  last_name: 'Soyad',
  class_level: 'Sınıf',
  section: 'Şube',
  gender: 'Cinsiyet',
  birth_date: 'Doğum Tarihi',
  registration_status: 'Kayıt Durumu',
  parent_name: 'Veli Adı',
  parent_phone: 'Veli Telefon',
  extra_contacts: 'Ek İletişim',
  is_inclusion: 'Kaynaştırma',
  is_foreign: 'Yabancı Uyruklu',
  school_id: 'Okul ID',
};

const IMPORTABLE_FIELD_KEYS = new Set(IMPORTABLE_FIELDS.map((f) => f.key));

function parseColumnMapping(raw) {
  if (raw == null || raw === '') return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      const err = new Error('Sütun eşlemesi (column_mapping) geçerli JSON olmalıdır');
      err.status = 400;
      throw err;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error('Sütun eşlemesi geçersiz');
    err.status = 400;
    throw err;
  }
  const mapping = {};
  Object.entries(parsed).forEach(([col, field]) => {
    if (field == null || field === '' || field === '__skip') return;
    if (!IMPORTABLE_FIELD_KEYS.has(field)) {
      const err = new Error(`Geçersiz alan: ${field}`);
      err.status = 400;
      throw err;
    }
    mapping[String(col)] = field;
  });
  return mapping;
}

function buildWhere(tenantId, filters = {}) {
  const where = {};
  if (tenantId) where.tenant_id = tenantId;
  if (filters.school_id) where.school_id = Number(filters.school_id);
  if (filters.classroom_id) where.classroom_id = Number(filters.classroom_id);
  if (filters.class_level) where.class_level = filters.class_level;
  if (filters.section) where.section = filters.section;
  if (filters.gender) where.gender = filters.gender;
  if (filters.registration_status) where.registration_status = filters.registration_status;
  return where;
}

async function applyClassroomToPayload(payload, tenantId) {
  if (!payload.classroom_id) {
    const err = new Error('Sınıf/şube seçimi zorunludur');
    err.status = 400;
    err.code = 'CLASSROOM_REQUIRED';
    throw err;
  }
  const classroom = await Classroom.findByPk(payload.classroom_id);
  if (!classroom || classroom.tenant_id !== tenantId) {
    const err = new Error('Seçilen sınıf/şube bulunamadı');
    err.status = 400;
    err.code = 'CLASSROOM_NOT_FOUND';
    throw err;
  }
  payload.class_level = classroom.class_level;
  payload.section = classroom.section;
  if (classroom.school_id && !payload.school_id) {
    payload.school_id = classroom.school_id;
  }
  return classroom;
}

async function findClassroomForImport(tenantId, classLevel, section, schoolId) {
  const parsed = parseClassSection(classLevel, section);
  const normalizedLevel = parsed
    ? parsed.class_level
    : classLevel
      ? String(classLevel).trim()
      : null;
  const normalizedSection = parsed
    ? parsed.section
    : section
      ? String(section).trim().toLocaleUpperCase('tr-TR')
      : null;
  if (!normalizedLevel || !normalizedSection) return null;

  const where = {
    tenant_id: tenantId,
    class_level: normalizedLevel,
    is_active: true,
  };
  if (schoolId) where.school_id = schoolId;
  const candidates = await Classroom.findAll({ where });
  let classroom = candidates.find(
    (c) => String(c.section || '').toLocaleUpperCase('tr-TR') === normalizedSection
  );
  if (classroom) return classroom;

  const looseWhere = { tenant_id: tenantId, is_active: true };
  if (schoolId) looseWhere.school_id = schoolId;
  const all = await Classroom.findAll({ where: looseWhere });
  classroom = all.find(
    (c) =>
      String(Number(c.class_level)) === String(Number(normalizedLevel)) &&
      !Number.isNaN(Number(normalizedLevel)) &&
      String(c.section || '').toLocaleUpperCase('tr-TR') === normalizedSection
  );
  return classroom || null;
}

async function resolveOrCreateClassroomForImport(tenantId, classLevel, section, schoolId) {
  const parsed = parseClassSection(classLevel, section);
  const normalizedLevel = parsed
    ? parsed.class_level
    : classLevel
      ? String(classLevel).trim()
      : null;
  const normalizedSection = parsed
    ? parsed.section
    : section
      ? String(section).trim().toLocaleUpperCase('tr-TR')
      : null;
  if (!normalizedLevel || !normalizedSection) return null;
  const existing = await findClassroomForImport(
    tenantId,
    normalizedLevel,
    normalizedSection,
    schoolId
  );
  if (existing) return existing;

  return Classroom.create({
    tenant_id: tenantId,
    school_id: schoolId || null,
    class_level: normalizedLevel,
    section: normalizedSection,
    is_active: true,
  });
}

function uniqueConstraintMessage(err) {
  const fields = (err.errors || []).map((e) => e.path);
  if (fields.includes('student_number')) {
    return {
      code: 'DUPLICATE_STUDENT_NUMBER',
      message: 'Bu öğrenci numarası bu hesapta zaten kayıtlı',
    };
  }
  return {
    code: 'DUPLICATE_NATIONAL_ID',
    message: 'Bu T.C. kimlik numarası bu hesapta zaten kayıtlı',
  };
}

function normalizeGender(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toLocaleLowerCase('tr-TR');
  if (['k', 'kız', 'kiz', 'kadın', 'kadin', 'female', 'f'].includes(raw)) return 'K';
  if (['e', 'erkek', 'male', 'm'].includes(raw)) return 'E';
  if (raw === 'k' || raw === 'e') return raw.toUpperCase();
  return null;
}

function normalizeBool(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLocaleLowerCase('tr-TR');
  return ['1', 'true', 'evet', 'e', 'x', 'var'].includes(raw);
}

function parseBirthDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

function normalizeNationalId(value) {
  if (value == null || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}

function normalizeStudentNumber(value) {
  if (value == null || value === '') return null;
  let s = String(value).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  return s || null;
}

function rememberStudent(maps, student) {
  const nid = normalizeNationalId(student.national_id);
  const num = normalizeStudentNumber(student.student_number);
  if (nid) maps.byNationalId.set(nid, student);
  if (num) maps.byStudentNumber.set(num, student);
}

function findExistingStudent(maps, nationalId, studentNumber) {
  if (nationalId && maps.byNationalId.has(nationalId)) return maps.byNationalId.get(nationalId);
  if (studentNumber && maps.byStudentNumber.has(studentNumber)) {
    return maps.byStudentNumber.get(studentNumber);
  }
  return null;
}

function pickChangedFields(existing, incoming) {
  const patch = {};
  Object.entries(incoming).forEach(([key, next]) => {
    if (next == null || next === '') return;
    if (key === 'is_inclusion' || key === 'is_foreign') {
      if (Boolean(existing[key]) !== Boolean(next)) patch[key] = next;
      return;
    }
    if (String(existing[key] ?? '') !== String(next)) patch[key] = next;
  });
  return patch;
}

function formatExtraContacts(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return '';
  return contacts
    .map((c) => {
      const parts = [c.label, c.phone, c.address, c.description].filter(Boolean);
      return parts.join(' · ');
    })
    .filter(Boolean)
    .join(' | ');
}

function normalizeExtraContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .map((c) => ({
      label: c.label ? String(c.label).trim() : null,
      phone: c.phone ? String(c.phone).trim() : null,
      address: c.address ? String(c.address).trim() : null,
      description: c.description ? String(c.description).trim() : null,
    }))
    .filter((c) => c.label || c.phone || c.address || c.description)
    .map((c) => ({
      label: c.label || null,
      phone: c.phone || null,
      address: c.address || null,
      description: c.description || null,
    }));
}

function formatCellValue(student, key) {
  const value = student[key];
  if (key === 'extra_contacts') return formatExtraContacts(value);
  if (value == null || value === '') return '';
  if (key === 'is_inclusion' || key === 'is_foreign') return value ? 'Evet' : 'Hayır';
  if (key === 'gender') return value === 'K' ? 'Kız' : value === 'E' ? 'Erkek' : value;
  return String(value);
}

function matchesStudentSearch(student, q) {
  const needle = String(q || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
  if (!needle) return true;
  const fullName = `${student.first_name} ${student.last_name}`.toLocaleLowerCase('tr-TR');
  const reverseName = `${student.last_name} ${student.first_name}`.toLocaleLowerCase('tr-TR');
  return (
    fullName.includes(needle) ||
    reverseName.includes(needle) ||
    String(student.first_name || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(student.last_name || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(student.student_number || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(student.national_id || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle)
  );
}

function assertTenantAccess(req, student) {
  if (req.user && req.user.tenant_id && student.tenant_id !== req.user.tenant_id) {
    return false;
  }
  return true;
}

module.exports = {
  COLUMN_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = buildWhere(tenantId, req.query);
      const students = await Student.findAll({
        where,
        include: [
          {
            model: Classroom,
            attributes: ['id', 'class_level', 'section', 'teacher_id', 'school_id'],
            required: false,
          },
        ],
        order: [
          ['class_level', 'ASC'],
          ['section', 'ASC'],
          ['student_number', 'ASC'],
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
        ],
        limit: 2000,
      });
      res.json({ success: true, data: students });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const student = await Student.findByPk(req.params.id, {
        include: [{ model: Classroom, required: false }],
      });
      if (!student) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, student)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: student });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.gender === '') payload.gender = null;
      if (payload.national_id === '') payload.national_id = null;
      if (payload.student_number) payload.student_number = String(payload.student_number).trim();
      if (!payload.registration_status) payload.registration_status = 'aktif';
      if (payload.extra_contacts !== undefined) {
        payload.extra_contacts = normalizeExtraContacts(payload.extra_contacts);
      } else {
        payload.extra_contacts = [];
      }
      await applyClassroomToPayload(payload, payload.tenant_id);
      const student = await Student.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'student',
        entityId: student.id,
        summary: `Öğrenci oluşturuldu: ${student.student_number || ''} ${student.first_name} ${student.last_name}`.trim(),
      });
      res.status(201).json({ success: true, data: student });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      if (err.name === 'SequelizeUniqueConstraintError') {
        const info = uniqueConstraintMessage(err);
        return res.status(409).json({ success: false, ...info });
      }
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const student = await Student.findByPk(req.params.id);
      if (!student) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, student)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      if (payload.gender === '') payload.gender = null;
      if (payload.national_id === '') payload.national_id = null;
      if (payload.student_number != null) payload.student_number = String(payload.student_number).trim();
      if (payload.extra_contacts !== undefined) {
        payload.extra_contacts = normalizeExtraContacts(payload.extra_contacts);
      }
      if (payload.classroom_id) {
        await applyClassroomToPayload(payload, payload.tenant_id || student.tenant_id);
      }
      await student.update(payload);
      await audit.log(req, {
        action: 'update',
        entityType: 'student',
        entityId: student.id,
        summary: `Öğrenci güncellendi: ${student.student_number || ''} ${student.first_name} ${student.last_name}`.trim(),
      });
      res.json({ success: true, data: student });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      if (err.name === 'SequelizeUniqueConstraintError') {
        const info = uniqueConstraintMessage(err);
        return res.status(409).json({ success: false, ...info });
      }
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const student = await Student.findByPk(req.params.id);
      if (!student) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, student)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const label = `${student.student_number || ''} ${student.first_name} ${student.last_name}`.trim();
      const id = student.id;
      await student.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'student',
        entityId: id,
        summary: `Öğrenci silindi: ${label}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async previewImport(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          code: 'FILE_REQUIRED',
          message: 'Excel dosyası gerekli (.xls veya .xlsx)',
        });
      }

      const headerRow = req.body.header_row ? Number(req.body.header_row) : null;
      const preview = previewWorkbook(req.file.buffer, { headerRow });
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  },

  async importExcel(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          code: 'FILE_REQUIRED',
          message: 'Excel dosyası gerekli (.xls veya .xlsx)',
        });
      }

      const tenantId = req.user.tenant_id;
      const schoolId = req.body.school_id ? Number(req.body.school_id) : null;
      const classroomId = req.body.classroom_id ? Number(req.body.classroom_id) : null;
      const headerRow = req.body.header_row ? Number(req.body.header_row) : null;
      const bodyClassLevel = req.body.class_level ? String(req.body.class_level).trim() : null;
      const bodySection = req.body.section
        ? String(req.body.section).trim().toLocaleUpperCase('tr-TR')
        : null;

      let columnMapping = parseColumnMapping(req.body.column_mapping);
      let effectiveHeaderRow = headerRow;
      let preview = null;

      if (!columnMapping || Object.keys(columnMapping).length === 0) {
        preview = previewWorkbook(req.file.buffer, { headerRow: effectiveHeaderRow });
        columnMapping = preview.suggested_mapping;
        if (!effectiveHeaderRow) effectiveHeaderRow = preview.header_row;
      }
      if (!effectiveHeaderRow) effectiveHeaderRow = 1;
      if (!preview) {
        preview = previewWorkbook(req.file.buffer, { headerRow: effectiveHeaderRow });
      }

      const mappedFields = Object.values(columnMapping);
      if (!mappedFields.includes('first_name') || !mappedFields.includes('last_name')) {
        return res.status(400).json({
          success: false,
          message: 'Ad ve Soyad sütun eşlemesi zorunludur',
        });
      }
      if (!mappedFields.includes('student_number')) {
        return res.status(400).json({
          success: false,
          message: 'Öğrenci No sütun eşlemesi zorunludur',
        });
      }

      let defaultClassroom = null;
      if (classroomId) {
        defaultClassroom = await Classroom.findByPk(classroomId);
        if (!defaultClassroom || defaultClassroom.tenant_id !== tenantId) {
          return res.status(400).json({
            success: false,
            message: 'Seçilen sınıf/şube bulunamadı',
          });
        }
      }

      const detected = preview.detected_class;
      const defaultClassLevel = bodyClassLevel || (detected && detected.class_level) || null;
      const defaultSection =
        bodySection || (detected && detected.section) || null;

      const hasClassHint =
        mappedFields.includes('class_level') || mappedFields.includes('section');

      if (!hasClassHint && !defaultClassroom) {
        if (!defaultClassLevel || !defaultSection) {
          return res.status(400).json({
            success: false,
            message:
              'Excelde Sınıf/Şube sütunu yoksa varsayılan sınıf/şube seçimi veya dosyadan algılanan sınıf bilgisi zorunludur',
          });
        }
        defaultClassroom = await resolveOrCreateClassroomForImport(
          tenantId,
          defaultClassLevel,
          defaultSection,
          schoolId
        );
      }

      const rows = getMappedRows(req.file.buffer, {
        headerRow: effectiveHeaderRow,
        columnMapping,
      });

      const existingRows = await Student.findAll({ where: { tenant_id: tenantId } });
      const maps = { byNationalId: new Map(), byStudentNumber: new Map() };
      existingRows.forEach((s) => rememberStudent(maps, s));

      const classroomCache = new Map();
      async function classroomFor(level, section, rowSchoolId) {
        const key = `${level}|${section}|${rowSchoolId || ''}`;
        if (classroomCache.has(key)) return classroomCache.get(key);
        const room = await resolveOrCreateClassroomForImport(
          tenantId,
          level,
          section,
          rowSchoolId
        );
        classroomCache.set(key, room);
        return room;
      }

      let created = 0;
      let updated = 0;
      const errors = [];

      for (const { rowNumber, raw } of rows) {
        if (!raw.first_name && !raw.last_name && !raw.national_id && !raw.student_number) {
          continue;
        }

        if (!raw.first_name || !raw.last_name) {
          errors.push({ row: rowNumber, message: 'Ad ve soyad zorunludur' });
          continue;
        }
        const studentNumber = normalizeStudentNumber(raw.student_number);
        if (!studentNumber) {
          errors.push({ row: rowNumber, message: 'Öğrenci numarası zorunludur' });
          continue;
        }

        const parsedClass = parseClassSection(raw.class_level, raw.section);
        const classInfo = parsedClass
          || (defaultClassroom
            ? { class_level: defaultClassroom.class_level, section: defaultClassroom.section }
            : defaultClassLevel && defaultSection
              ? { class_level: defaultClassLevel, section: defaultSection }
              : null);

        if (!classInfo) {
          errors.push({
            row: rowNumber,
            message: `Sınıf/şube okunamadı: ${raw.class_level || '?'}/${raw.section || '?'}`,
          });
          continue;
        }

        const rowSchoolId =
          schoolId || (defaultClassroom && defaultClassroom.school_id) || null;
        let classroom;
        try {
          classroom = await classroomFor(classInfo.class_level, classInfo.section, rowSchoolId);
        } catch (err) {
          errors.push({
            row: rowNumber,
            message: err.message || `Sınıf oluşturulamadı: ${classInfo.class_level}/${classInfo.section}`,
          });
          continue;
        }

        if (!classroom) {
          errors.push({
            row: rowNumber,
            message: `Tanımlı sınıf/şube bulunamadı: ${classInfo.class_level}/${classInfo.section}`,
          });
          continue;
        }

        const nationalId = normalizeNationalId(raw.national_id);
        const incoming = {
          school_id: schoolId || classroom.school_id,
          classroom_id: classroom.id,
          student_number: studentNumber,
          first_name: String(raw.first_name).trim(),
          last_name: String(raw.last_name).trim(),
          class_level: classroom.class_level,
          section: classroom.section,
        };
        if (nationalId) incoming.national_id = nationalId;
        const gender = normalizeGender(raw.gender);
        if (gender) incoming.gender = gender;
        const birthDate = parseBirthDate(raw.birth_date);
        if (birthDate) incoming.birth_date = birthDate;
        if (raw.registration_status) incoming.registration_status = raw.registration_status;
        if (raw.parent_name) incoming.parent_name = String(raw.parent_name).trim();
        if (raw.parent_phone) incoming.parent_phone = String(raw.parent_phone).trim();
        if (raw.is_inclusion != null && raw.is_inclusion !== '') {
          incoming.is_inclusion = normalizeBool(raw.is_inclusion);
        }
        if (raw.is_foreign != null && raw.is_foreign !== '') {
          incoming.is_foreign = normalizeBool(raw.is_foreign);
        }

        try {
          let existing = findExistingStudent(maps, nationalId, studentNumber);
          if (existing) {
            const patch = pickChangedFields(existing, incoming);
            if (Object.keys(patch).length > 0) {
              await existing.update(patch);
            }
            rememberStudent(maps, existing);
            updated += 1;
            continue;
          }

          const createdStudent = await Student.create({
            tenant_id: tenantId,
            ...incoming,
            registration_status: incoming.registration_status || 'aktif',
            is_inclusion: incoming.is_inclusion || false,
            is_foreign: incoming.is_foreign || false,
            national_id: nationalId,
            meta: { import_row: rowNumber },
          });
          rememberStudent(maps, createdStudent);
          created += 1;
        } catch (err) {
          if (err.name === 'SequelizeUniqueConstraintError') {
            const again =
              (nationalId &&
                (await Student.findOne({
                  where: { tenant_id: tenantId, national_id: nationalId },
                }))) ||
              (await Student.findOne({
                where: { tenant_id: tenantId, student_number: studentNumber },
              }));
            if (again) {
              const patch = pickChangedFields(again, incoming);
              if (Object.keys(patch).length > 0) {
                await again.update(patch);
              }
              rememberStudent(maps, again);
              updated += 1;
              continue;
            }
            const info = uniqueConstraintMessage(err);
            errors.push({ row: rowNumber, message: info.message });
            continue;
          }
          errors.push({
            row: rowNumber,
            message: err.message || 'Satır işlenemedi',
          });
        }
      }

      res.json({
        success: true,
        data: { created, updated, errors },
      });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, columns, filters } = req.validatedBody || req.body;
      const allowed = columns.filter((c) => COLUMN_LABELS[c]);
      if (allowed.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Geçerli sütun seçilmedi',
        });
      }

      const queryFilters = { ...(filters || {}) };
      const searchQ = queryFilters.q;
      delete queryFilters.q;

      let students = await Student.findAll({
        where: buildWhere(tenantId, queryFilters),
        order: [
          ['class_level', 'ASC'],
          ['section', 'ASC'],
          ['student_number', 'ASC'],
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
        ],
        limit: 5000,
      });

      if (searchQ) {
        students = students.filter((s) => matchesStudentSearch(s, searchQ));
      }

      const headers = allowed.map((key) => COLUMN_LABELS[key]);
      const rows = students.map((student) => allowed.map((key) => formatCellValue(student, key)));

      await sendTableExport(res, {
        format,
        filename: 'ogrenciler',
        title: 'Öğrenci Listesi',
        headers,
        rows,
      });
    } catch (err) {
      next(err);
    }
  },
};
