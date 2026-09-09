'use strict';

const PDFDocument = require('pdfkit');
const { Teacher, School } = require('../models');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');

const PERSONNEL_DOCUMENT_TITLES = {
  gorevlendirme: 'GÖREVLENDİRME YAZISI',
  baslama: 'GÖREVE BAŞLAMA YAZISI',
  ayrilis: 'AYRILIŞ YAZISI',
};

const COLUMN_LABELS = {
  first_name: 'Ad',
  last_name: 'Soyad',
  personnel_no: 'Sicil No',
  national_id: 'T.C. Kimlik No',
  title_branch: 'Unvan / Branş',
  school_name: 'Okul',
  city: 'Şehir',
  district: 'İlçe',
  working_institution: 'Görev Yeri',
  degree: 'Derece',
  rank: 'Kademe',
  pension_degree: 'Emekli Sicil No',
  last_graduated_school: 'Mezun Olunan Okul',
  class_level: 'Sınıf / Kademe',
  school_principal: 'Okul Müdürü',
};

const DEFAULT_COLUMNS = [
  'first_name',
  'last_name',
  'personnel_no',
  'national_id',
  'title_branch',
  'school_name',
  'city',
  'district',
];

function matchesTeacherSearch(teacher, q) {
  const needle = String(q || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
  if (!needle) return true;
  const fullName = `${teacher.first_name} ${teacher.last_name}`.toLocaleLowerCase('tr-TR');
  const reverseName = `${teacher.last_name} ${teacher.first_name}`.toLocaleLowerCase('tr-TR');
  return (
    fullName.includes(needle) ||
    reverseName.includes(needle) ||
    String(teacher.first_name || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.last_name || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.personnel_no || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.national_id || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle)
  );
}

function formatTeacherCell(teacher, key) {
  if (key === 'school_name') return teacher.School?.name || '';
  const value = teacher[key];
  if (value == null || value === '') return '';
  if (key === 'degree_rank_date') {
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(value);
}

// 657 sayılı DMK madde 64: bulunduğu kademede en az bir yıl çalışan (ceza almamış)
// memur bir üst kademeye ilerler. Kesin mevzuat istisnaları (derece tavanı, disiplin
// cezası vb.) hesaba katılmaz; bu, yaklaşık bir hatırlatma listesidir.
function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

module.exports = {
  COLUMN_LABELS,

  async document(req, res, next) {
    try {
      const type = PERSONNEL_DOCUMENT_TITLES[req.query.type] ? req.query.type : 'gorevlendirme';
      const teacher = await Teacher.findByPk(req.params.id, {
        include: [{ model: School, required: false }],
      });
      if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-${teacher.personnel_no || teacher.id}.pdf"`);
      doc.pipe(res);

      const schoolName = teacher.School?.name || 'Okul Müdürlüğü';
      doc.fontSize(13).text(schoolName.toUpperCase(), { align: 'center' });
      doc.fontSize(13).text(PERSONNEL_DOCUMENT_TITLES[type], { align: 'center' });
      doc.moveDown(2);

      const rows = [
        ['Adı Soyadı', `${teacher.first_name} ${teacher.last_name}`],
        ['Sicil No', teacher.personnel_no || '—'],
        ['Unvan / Branş', teacher.title_branch || '—'],
        ['Görev Yeri', teacher.working_institution || schoolName],
      ];

      doc.fontSize(11);
      rows.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
        doc.moveDown(0.5);
      });

      doc.moveDown(2);
      const bodyTextMap = {
        gorevlendirme: `Yukarıda kimlik bilgileri yazılı personel, kurumumuzda ilgili görevle görevlendirilmiştir. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
        baslama: `Yukarıda kimlik bilgileri yazılı personel, kurumumuzda göreve başlamıştır. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
        ayrilis: `Yukarıda kimlik bilgileri yazılı personelin kurumumuzdaki görevi sona ermiş ve ayrılış işlemleri tamamlanmıştır. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
      };
      doc.text(bodyTextMap[type], { align: 'justify' });

      doc.moveDown(4);
      doc.text(`Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
      doc.moveDown(2);
      doc.text('Okul Müdürü', { align: 'right' });

      await audit.log(req, {
        action: 'export',
        entityType: 'teacher_document',
        entityId: teacher.id,
        summary: `${PERSONNEL_DOCUMENT_TITLES[type]} üretildi: ${teacher.first_name} ${teacher.last_name}`,
      });

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async upcomingPromotions(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const days = req.query.days ? Number(req.query.days) : 90;
      const where = { tenant_id: tenantId };
      const teachers = await Teacher.findAll({
        where,
        order: [['degree_rank_date', 'ASC']],
      });

      const today = new Date();
      const horizon = new Date(today.getTime() + days * 86400000);

      const data = teachers
        .filter((t) => t.degree_rank_date)
        .map((t) => {
          const nextDate = addYears(t.degree_rank_date, 1);
          const daysRemaining = Math.round((nextDate.getTime() - today.getTime()) / 86400000);
          return {
            teacher_id: t.id,
            teacher_name: `${t.first_name} ${t.last_name}`,
            personnel_no: t.personnel_no,
            degree: t.degree,
            rank: t.rank,
            degree_rank_date: t.degree_rank_date,
            next_promotion_date: nextDate.toISOString().slice(0, 10),
            days_remaining: daysRemaining,
          };
        })
        .filter((row) => new Date(row.next_promotion_date) <= horizon)
        .sort((a, b) => a.days_remaining - b.days_remaining);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      const teachers = await Teacher.findAll({ where, limit: 500 });
      res.json({ success: true, data: teachers });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: teacher });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      const teacher = await Teacher.create(payload);
      await audit.log(req, {
        action: 'create',
        entityType: 'teacher',
        entityId: teacher.id,
        summary: `Öğretmen oluşturuldu: ${teacher.first_name} ${teacher.last_name}`,
      });
      res.status(201).json({ success: true, data: teacher });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const payload = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      await teacher.update(payload);
      await audit.log(req, {
        action: 'update',
        entityType: 'teacher',
        entityId: teacher.id,
        summary: `Öğretmen güncellendi: ${teacher.first_name} ${teacher.last_name}`,
      });
      res.json({ success: true, data: teacher });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const label = `${teacher.first_name} ${teacher.last_name}`;
      const id = teacher.id;
      await teacher.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'teacher',
        entityId: id,
        summary: `Öğretmen silindi: ${label}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async exportFile(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { format, columns, filters } = req.validatedBody || req.body;
      const requested = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
      const allowed = requested.filter((c) => COLUMN_LABELS[c]);
      if (allowed.length === 0) {
        return res.status(400).json({ success: false, message: 'Geçerli sütun seçilmedi' });
      }

      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters?.school_id) where.school_id = Number(filters.school_id);

      let teachers = await Teacher.findAll({
        where,
        include: [{ model: School, attributes: ['id', 'name'], required: false }],
        order: [
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
        ],
        limit: 5000,
      });

      if (filters?.q) {
        teachers = teachers.filter((t) => matchesTeacherSearch(t, filters.q));
      }

      await sendTableExport(res, {
        format,
        filename: 'ogretmenler',
        title: 'Öğretmen Listesi',
        headers: allowed.map((key) => COLUMN_LABELS[key]),
        rows: teachers.map((t) => allowed.map((key) => formatTeacherCell(t, key))),
      });
    } catch (err) {
      next(err);
    }
  },
};
