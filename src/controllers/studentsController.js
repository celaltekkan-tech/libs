'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Student, Classroom, School } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const CERTIFICATE_TITLES = {
  ogrenci_belgesi: 'ÖĞRENCİ BELGESİ',
  ogrenim_durumu: 'ÖĞRENİM DURUM BELGESİ',
};

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

const IMPORT_HEADER_MAP = {
  't.c. kimlik no': 'national_id',
  'tc kimlik no': 'national_id',
  'tc kimlik': 'national_id',
  'kimlik no': 'national_id',
  'öğrenci no': 'student_number',
  'ogrenci no': 'student_number',
  'öğrenci numarası': 'student_number',
  'ogrenci numarasi': 'student_number',
  adı: 'first_name',
  adi: 'first_name',
  ad: 'first_name',
  soyadı: 'last_name',
  soyadi: 'last_name',
  soyad: 'last_name',
  sınıfı: 'class_level',
  sinifi: 'class_level',
  sınıf: 'class_level',
  sinif: 'class_level',
  şubesi: 'section',
  subesi: 'section',
  şube: 'section',
  sube: 'section',
  cinsiyeti: 'gender',
  cinsiyet: 'gender',
  'doğum tarihi': 'birth_date',
  'dogum tarihi': 'birth_date',
  'kayıt durumu': 'registration_status',
  'kayit durumu': 'registration_status',
  'veli adı': 'parent_name',
  'veli adi': 'parent_name',
  'veli telefon': 'parent_phone',
  'veli telefonu': 'parent_phone',
  kaynaştırma: 'is_inclusion',
  kaynastirma: 'is_inclusion',
  'yabancı uyruklu': 'is_foreign',
  'yabanci uyruklu': 'is_foreign',
};

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
  if (!classLevel || !section) return null;
  const where = {
    tenant_id: tenantId,
    class_level: classLevel,
    section,
    is_active: true,
  };
  if (schoolId) where.school_id = schoolId;
  return Classroom.findOne({ where });
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

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function cellToString(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value.text) return String(value.text).trim() || null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value).trim();
  return str || null;
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

  async certificate(req, res, next) {
    try {
      const type = CERTIFICATE_TITLES[req.query.type] ? req.query.type : 'ogrenci_belgesi';
      const student = await Student.findByPk(req.params.id, {
        include: [
          { model: Classroom, required: false },
          { model: School, required: false },
        ],
      });
      if (!student) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, student)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-${student.student_number || student.id}.pdf"`);
      doc.pipe(res);

      const schoolName = student.School?.name || 'Okul Müdürlüğü';
      doc.fontSize(13).text(schoolName.toUpperCase(), { align: 'center' });
      doc.fontSize(13).text(CERTIFICATE_TITLES[type], { align: 'center' });
      doc.moveDown(2);

      const rows = [
        ['Adı Soyadı', `${student.first_name} ${student.last_name}`],
        ['Öğrenci No', student.student_number || '—'],
        ['T.C. Kimlik No', student.national_id || '—'],
        ['Sınıfı / Şubesi', student.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : `${student.class_level || ''}/${student.section || ''}`],
        ['Kayıt Durumu', student.registration_status || '—'],
      ];

      doc.fontSize(11);
      rows.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
        doc.moveDown(0.5);
      });

      doc.moveDown(2);
      const bodyText =
        type === 'ogrenim_durumu'
          ? `Yukarıda kimlik bilgileri yazılı öğrencinin okulumuz kayıtlarına göre öğrenim durumu bu belge ile onaylanmıştır.`
          : `Yukarıda kimlik bilgileri yazılı öğrencinin okulumuzda kayıtlı öğrenci olduğu bu belge ile onaylanmıştır.`;
      doc.text(bodyText, { align: 'justify' });

      doc.moveDown(4);
      doc.text(`Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
      doc.moveDown(2);
      doc.text('Okul Müdürü', { align: 'right' });

      await audit.log(req, {
        action: 'export',
        entityType: 'student_certificate',
        entityId: student.id,
        summary: `${CERTIFICATE_TITLES[type]} üretildi: ${student.first_name} ${student.last_name}`,
      });

      doc.end();
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
          message: 'Excel dosyası gerekli (.xlsx)',
        });
      }

      const tenantId = req.user.tenant_id;
      const schoolId = req.body.school_id ? Number(req.body.school_id) : null;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({
          success: false,
          message: 'Excel dosyasında sayfa bulunamadı',
        });
      }

      const headerRow = sheet.getRow(1);
      const columnMap = {};
      headerRow.eachCell((cell, colNumber) => {
        const key = IMPORT_HEADER_MAP[normalizeHeader(cell.value)];
        if (key) columnMap[colNumber] = key;
      });

      if (!Object.values(columnMap).includes('first_name') || !Object.values(columnMap).includes('last_name')) {
        return res.status(400).json({
          success: false,
          message: 'Excel başlıklarında Ad ve Soyad sütunları zorunludur',
        });
      }

      let created = 0;
      let updated = 0;
      const errors = [];

      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;

        const raw = {};
        Object.entries(columnMap).forEach(([col, key]) => {
          raw[key] = cellToString(row.getCell(Number(col)).value);
        });

        if (!raw.first_name && !raw.last_name && !raw.national_id) continue;

        if (!raw.first_name || !raw.last_name) {
          errors.push({ row: rowNumber, message: 'Ad ve soyad zorunludur' });
          continue;
        }
        if (!raw.student_number) {
          errors.push({ row: rowNumber, message: 'Öğrenci numarası zorunludur' });
          continue;
        }

        const classroom = await findClassroomForImport(
          tenantId,
          raw.class_level,
          raw.section,
          schoolId
        );
        if (!classroom) {
          errors.push({
            row: rowNumber,
            message: `Tanımlı sınıf/şube bulunamadı: ${raw.class_level || '?'}/${raw.section || '?'}`,
          });
          continue;
        }

        const payload = {
          tenant_id: tenantId,
          school_id: schoolId || classroom.school_id,
          classroom_id: classroom.id,
          student_number: raw.student_number,
          national_id: raw.national_id || null,
          first_name: raw.first_name,
          last_name: raw.last_name,
          class_level: classroom.class_level,
          section: classroom.section,
          gender: normalizeGender(raw.gender),
          birth_date: parseBirthDate(raw.birth_date),
          registration_status: raw.registration_status || 'aktif',
          parent_name: raw.parent_name || null,
          parent_phone: raw.parent_phone || null,
          is_inclusion: normalizeBool(raw.is_inclusion),
          is_foreign: normalizeBool(raw.is_foreign),
          meta: { import_row: rowNumber },
        };

        try {
          let existing = null;
          if (payload.national_id) {
            existing = await Student.findOne({
              where: { tenant_id: tenantId, national_id: payload.national_id },
            });
          }
          if (!existing) {
            existing = await Student.findOne({
              where: { tenant_id: tenantId, student_number: payload.student_number },
            });
          }
          if (existing) {
            await existing.update(payload);
            updated += 1;
            continue;
          }
          await Student.create(payload);
          created += 1;
        } catch (err) {
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
