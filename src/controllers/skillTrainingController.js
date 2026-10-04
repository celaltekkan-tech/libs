'use strict';

const { Op } = require('sequelize');
const {
  SkillBusiness,
  SkillPlacement,
  SkillSupportMonth,
  SkillSgkNotice,
  School,
  Student,
  Teacher,
} = require('../models');
const audit = require('../services/auditService');
const { workbookBuffer, monthName } = require('../services/skillDocumentService');
const { calendarDate } = require('../utils/calendarDate');
const { documentSchema } = require('../validators/skillTraining.validator');

const STUDENT_ATTRS = ['id', 'first_name', 'last_name', 'student_number', 'national_id', 'class_level', 'section'];
const BUSINESS_ATTRS = ['id', 'name', 'tax_no', 'sgk_workplace_no', 'address', 'master_name', 'contact_name', 'field_name', 'phone'];

function blank(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function personName(row) {
  if (!row) return '';
  return `${row.first_name || ''} ${row.last_name || ''}`.trim();
}

function classLabel(student) {
  if (!student) return '';
  return [student.class_level, student.section].filter(Boolean).join('/');
}

function statusLabel(status) {
  if (status === 'tamamlandi') return 'Tamamlandı';
  if (status === 'ayrildi') return 'Ayrıldı';
  if (status === 'odendi') return 'Ödendi';
  if (status === 'bekliyor') return 'Bekliyor';
  if (status === 'bildirildi') return 'Bildirildi';
  if (status === 'taslak') return 'Taslak';
  if (status === 'giris') return 'İşe giriş';
  if (status === 'cikis') return 'İşten çıkış';
  return 'Aktif';
}

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end, last };
}

function overlaps(row, start, end) {
  if (row.start_date && row.start_date > end) return false;
  if (row.end_date && row.end_date < start) return false;
  return true;
}

async function schoolOf(req, schoolId) {
  const school = await School.findByPk(schoolId);
  if (!school) return null;
  if (req.user && req.user.tenant_id && school.tenant_id !== req.user.tenant_id) return null;
  return school;
}

function placementInclude() {
  return [
    { model: Student, attributes: STUDENT_ATTRS },
    { model: SkillBusiness, as: 'Business', attributes: BUSINESS_ATTRS },
    { model: Teacher, as: 'Coordinator', attributes: ['id', 'first_name', 'last_name'] },
  ];
}

async function loadPlacement(req, id) {
  const row = await SkillPlacement.findByPk(id, { include: placementInclude() });
  if (!row) return null;
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return null;
  return row;
}

function placementSheet(schoolName, row) {
  const student = row.Student;
  const business = row.Business;
  return {
    studentName: personName(student),
    identity: [student?.national_id, student?.student_number].filter(Boolean).join(' / '),
    classLabel: classLabel(student),
    businessName: business?.name || '',
    taxNo: business?.tax_no || '',
    sgkNo: business?.sgk_workplace_no || '',
    address: business?.address || '',
    masterName: business?.master_name || '',
    contactName: business?.contact_name || '',
    teacherName: personName(row.Coordinator),
    academicYear: row.academic_year || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    weeklyDays: row.weekly_days,
    contractNo: row.contract_no || '',
    contractDate: row.contract_date || '',
    statusLabel: statusLabel(row.status),
    note: row.note || '',
    schoolName,
  };
}

module.exports = {
  async listBusinesses(req, res, next) {
    try {
      const school = await schoolOf(req, Number(req.query.school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const rows = await SkillBusiness.findAll({
        where: { tenant_id: school.tenant_id, school_id: school.id },
        order: [['name', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createBusiness(req, res, next) {
    try {
      const body = { ...(req.validatedBody || req.body) };
      const school = await schoolOf(req, body.school_id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      for (const key of ['tax_no', 'sgk_workplace_no', 'address', 'phone', 'field_name', 'master_name', 'contact_name']) {
        body[key] = blank(body[key]);
      }
      const row = await SkillBusiness.create({ ...body, tenant_id: school.tenant_id, school_id: school.id });
      await audit.log(req, { action: 'create', entityType: 'skill_business', entityId: row.id, summary: `İşletme eklendi: ${row.name}` });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async updateBusiness(req, res, next) {
    try {
      const row = await SkillBusiness.findByPk(req.params.id);
      if (!row || (req.user?.tenant_id && row.tenant_id !== req.user.tenant_id)) {
        return res.status(404).json({ success: false, message: 'Bulunamadı' });
      }
      const body = { ...(req.validatedBody || req.body) };
      delete body.school_id;
      for (const key of ['tax_no', 'sgk_workplace_no', 'address', 'phone', 'field_name', 'master_name', 'contact_name']) {
        if (key in body) body[key] = blank(body[key]);
      }
      await row.update(body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async removeBusiness(req, res, next) {
    try {
      const row = await SkillBusiness.findByPk(req.params.id);
      if (!row || (req.user?.tenant_id && row.tenant_id !== req.user.tenant_id)) {
        return res.status(404).json({ success: false, message: 'Bulunamadı' });
      }
      const used = await SkillPlacement.count({ where: { business_id: row.id } });
      if (used) return res.status(400).json({ success: false, message: 'Yerleştirmesi olan işletme silinemez' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async listPlacements(req, res, next) {
    try {
      const school = await schoolOf(req, Number(req.query.school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const rows = await SkillPlacement.findAll({
        where: { tenant_id: school.tenant_id, school_id: school.id },
        include: placementInclude(),
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createPlacement(req, res, next) {
    try {
      const body = { ...(req.validatedBody || req.body) };
      const school = await schoolOf(req, body.school_id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const student = await Student.findByPk(body.student_id);
      if (!student || student.tenant_id !== school.tenant_id || student.school_id !== school.id) {
        return res.status(400).json({ success: false, message: 'Öğrenci bu okula ait değil' });
      }
      const business = await SkillBusiness.findByPk(body.business_id);
      if (!business || business.school_id !== school.id) {
        return res.status(400).json({ success: false, message: 'İşletme bu okula ait değil' });
      }
      if (body.teacher_id) {
        const teacher = await Teacher.findByPk(body.teacher_id);
        if (!teacher || teacher.tenant_id !== school.tenant_id) {
          return res.status(400).json({ success: false, message: 'Öğretmen bulunamadı' });
        }
      }
      for (const key of ['academic_year', 'contract_no', 'note', 'start_date', 'end_date', 'contract_date']) {
        body[key] = blank(body[key]);
      }
      const row = await SkillPlacement.create({ ...body, tenant_id: school.tenant_id, school_id: school.id, teacher_id: body.teacher_id || null });
      const full = await loadPlacement(req, row.id);
      await audit.log(req, {
        action: 'create',
        entityType: 'skill_placement',
        entityId: row.id,
        summary: `Beceri eğitimi yerleştirmesi: ${personName(student)}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updatePlacement(req, res, next) {
    try {
      const row = await loadPlacement(req, req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const body = { ...(req.validatedBody || req.body) };
      delete body.school_id;
      for (const key of ['academic_year', 'contract_no', 'note', 'start_date', 'end_date', 'contract_date']) {
        if (key in body) body[key] = blank(body[key]);
      }
      if ('teacher_id' in body) body.teacher_id = body.teacher_id || null;
      await row.update(body);
      res.json({ success: true, data: await loadPlacement(req, row.id) });
    } catch (err) {
      next(err);
    }
  },

  async removePlacement(req, res, next) {
    try {
      const row = await loadPlacement(req, req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async listSupports(req, res, next) {
    try {
      const school = await schoolOf(req, Number(req.query.school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const where = { tenant_id: school.tenant_id };
      if (req.query.year) where.year = Number(req.query.year);
      if (req.query.month) where.month = Number(req.query.month);
      const rows = await SkillSupportMonth.findAll({
        where,
        include: [{ model: SkillPlacement, required: true, where: { school_id: school.id }, include: placementInclude() }],
        order: [['year', 'DESC'], ['month', 'DESC'], ['id', 'ASC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async generateSupports(req, res, next) {
    try {
      const body = req.validatedBody || req.body;
      const school = await schoolOf(req, body.school_id);
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const { start, end } = monthBounds(body.year, body.month);
      const placements = await SkillPlacement.findAll({
        where: { tenant_id: school.tenant_id, school_id: school.id, status: { [Op.ne]: 'ayrildi' } },
      });
      let created = 0;
      for (const placement of placements) {
        if (!overlaps(placement, start, end)) continue;
        const [row, wasCreated] = await SkillSupportMonth.findOrCreate({
          where: { placement_id: placement.id, year: body.year, month: body.month },
          defaults: {
            tenant_id: school.tenant_id,
            work_days: Math.min(31, (placement.weekly_days || 0) * 4),
            status: 'bekliyor',
          },
        });
        if (wasCreated) created += 1;
        else void row;
      }
      res.json({ success: true, data: { created } });
    } catch (err) {
      next(err);
    }
  },

  async updateSupport(req, res, next) {
    try {
      const row = await SkillSupportMonth.findByPk(req.params.id, { include: [{ model: SkillPlacement }] });
      if (!row || (req.user?.tenant_id && row.tenant_id !== req.user.tenant_id)) {
        return res.status(404).json({ success: false, message: 'Bulunamadı' });
      }
      const body = { ...(req.validatedBody || req.body) };
      if ('note' in body) body.note = blank(body.note);
      if ('paid_at' in body) body.paid_at = blank(body.paid_at);
      if (body.status === 'odendi' && !body.paid_at && !row.paid_at) {
        body.paid_at = calendarDate(new Date());
      }
      await row.update(body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async listSgk(req, res, next) {
    try {
      const school = await schoolOf(req, Number(req.query.school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const rows = await SkillSgkNotice.findAll({
        where: { tenant_id: school.tenant_id },
        include: [{ model: SkillPlacement, required: true, where: { school_id: school.id }, include: placementInclude() }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async prepareSgk(req, res, next) {
    try {
      const school = await schoolOf(req, Number((req.validatedBody || req.body).school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const placements = await SkillPlacement.findAll({
        where: { tenant_id: school.tenant_id, school_id: school.id },
        include: [{ model: SkillSgkNotice, as: 'SgkNotices' }],
      });
      let created = 0;
      for (const placement of placements) {
        const kinds = new Set((placement.SgkNotices || []).map((n) => n.kind));
        if (!kinds.has('giris')) {
          await SkillSgkNotice.create({
            tenant_id: school.tenant_id,
            placement_id: placement.id,
            kind: 'giris',
            notice_date: placement.start_date,
            status: 'taslak',
          });
          created += 1;
        }
        if (placement.status !== 'aktif' && placement.end_date && !kinds.has('cikis')) {
          await SkillSgkNotice.create({
            tenant_id: school.tenant_id,
            placement_id: placement.id,
            kind: 'cikis',
            notice_date: placement.end_date,
            status: 'taslak',
          });
          created += 1;
        }
      }
      res.json({ success: true, data: { created } });
    } catch (err) {
      next(err);
    }
  },

  async updateSgk(req, res, next) {
    try {
      const row = await SkillSgkNotice.findByPk(req.params.id);
      if (!row || (req.user?.tenant_id && row.tenant_id !== req.user.tenant_id)) {
        return res.status(404).json({ success: false, message: 'Bulunamadı' });
      }
      const body = { ...(req.validatedBody || req.body) };
      if ('sgk_ref' in body) body.sgk_ref = blank(body.sgk_ref);
      if ('note' in body) body.note = blank(body.note);
      if ('notice_date' in body) body.notice_date = blank(body.notice_date);
      await row.update(body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async download(req, res, next) {
    try {
      const parsed = documentSchema.validate(req.query, { stripUnknown: true, convert: true });
      if (parsed.error) return res.status(400).json({ success: false, message: 'Evrak isteği geçersiz' });
      const query = parsed.value;
      const school = await schoolOf(req, Number(query.school_id));
      if (!school) return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
      const kind = query.kind;
      let buffer;
      let filename = 'beceri.xlsx';
      if (kind === 'sozlesme') {
        if (!query.placement_id) return res.status(400).json({ success: false, message: 'Yerleştirme seçin' });
        const row = await loadPlacement(req, query.placement_id);
        if (!row || row.school_id !== school.id) return res.status(404).json({ success: false, message: 'Yerleştirme bulunamadı' });
        buffer = await workbookBuffer('sozlesme', { schoolName: school.name, placement: placementSheet(school.name, row) });
        filename = 'beceri-sozlesme.xlsx';
      } else if (kind === 'devam') {
        const year = Number(query.year);
        const month = Number(query.month);
        if (!year || !month) return res.status(400).json({ success: false, message: 'Ay seçin' });
        const { start, end, last } = monthBounds(year, month);
        const placements = await SkillPlacement.findAll({
          where: { tenant_id: school.tenant_id, school_id: school.id, status: 'aktif' },
          include: placementInclude(),
          order: [['id', 'ASC']],
        });
        const rows = placements.filter((row) => overlaps(row, start, end)).map((row) => {
          const days = Array.from({ length: last }, () => '');
          return [personName(row.Student), classLabel(row.Student), row.Business?.name || '', row.Business?.master_name || '', ...days, '', ''];
        });
        buffer = await workbookBuffer('devam', { dayCount: last, rows });
        filename = `beceri-devam-${year}-${month}.xlsx`;
      } else if (kind === 'destek') {
        const year = Number(query.year);
        const month = Number(query.month);
        const where = { tenant_id: school.tenant_id };
        if (year) where.year = year;
        if (month) where.month = month;
        const supports = await SkillSupportMonth.findAll({
          where,
          include: [{ model: SkillPlacement, required: true, where: { school_id: school.id }, include: placementInclude() }],
          order: [['year', 'ASC'], ['month', 'ASC']],
        });
        const rows = supports.map((row) => {
          const placement = row.SkillPlacement;
          return [
            `${monthName(row.month)} ${row.year}`,
            personName(placement?.Student),
            classLabel(placement?.Student),
            placement?.Business?.name || '',
            placement?.Business?.sgk_workplace_no || '',
            row.work_days,
            row.amount == null ? '' : Number(row.amount),
            statusLabel(row.status),
            row.paid_at || '',
            row.note || '',
          ];
        });
        buffer = await workbookBuffer('destek', { rows });
        filename = 'beceri-devlet-katkisi.xlsx';
      } else {
        const notices = await SkillSgkNotice.findAll({
          where: { tenant_id: school.tenant_id },
          include: [{ model: SkillPlacement, required: true, where: { school_id: school.id }, include: placementInclude() }],
          order: [['id', 'ASC']],
        });
        const rows = notices.map((row) => {
          const placement = row.SkillPlacement;
          return [
            personName(placement?.Student),
            placement?.Student?.national_id || '',
            classLabel(placement?.Student),
            placement?.Business?.name || '',
            placement?.Business?.sgk_workplace_no || '',
            statusLabel(row.kind),
            row.notice_date || '',
            row.sgk_ref || '',
            statusLabel(row.status),
            row.note || '',
          ];
        });
        buffer = await workbookBuffer('sgk', { rows });
        filename = 'beceri-sgk.xlsx';
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  },
};
