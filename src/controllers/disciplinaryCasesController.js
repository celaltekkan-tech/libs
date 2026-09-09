'use strict';

const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const { DisciplinaryCase, Student, Classroom, School } = require('../models');
const audit = require('../services/auditService');

const SANCTION_LABELS = {
  uyari: 'Uyarı',
  kinama: 'Kınama',
  okuldan_kisa_sureli_uzaklastirma: 'Okuldan Kısa Süreli Uzaklaştırma',
  okuldan_uzun_sureli_uzaklastirma: 'Okuldan Uzun Süreli Uzaklaştırma',
  okul_degistirme: 'Okul Değiştirme',
};

const STATUS_LABELS = {
  acik: 'Açık',
  karara_baglandi: 'Karara Bağlandı',
  itiraz: 'İtiraz',
  kapandi: 'Kapandı',
};

const DOCUMENT_TITLES = {
  veli_tebligati: 'VELİ TEBLİGATI',
  savunma_istemi: 'SAVUNMA İSTEM YAZISI',
  karar_bildirimi: 'DİSİPLİN KARARI BİLDİRİM YAZISI',
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number'],
  include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
  required: false,
};

module.exports = {
  SANCTION_LABELS,
  STATUS_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.student_id) where.student_id = Number(req.query.student_id);
      if (req.query.status) where.status = req.query.status;

      const rows = await DisciplinaryCase.findAll({
        where,
        include: [studentInclude],
        order: [['incident_date', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;

      const student = await Student.findByPk(payload.student_id);
      if (!student || (tenantId && student.tenant_id !== tenantId)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğrenci bulunamadı' });
      }

      const row = await DisciplinaryCase.create(payload);
      const full = await DisciplinaryCase.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'disciplinary_case',
        entityId: row.id,
        summary: `Disiplin dosyası açıldı: ${student.first_name} ${student.last_name}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await DisciplinaryCase.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplinaryCase.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'disciplinary_case',
        entityId: row.id,
        summary: `Disiplin dosyası güncellendi (#${row.id})`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await DisciplinaryCase.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const id = row.id;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'disciplinary_case',
        entityId: id,
        summary: `Disiplin dosyası silindi (#${id})`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async stats(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.start_date && req.query.end_date) {
        where.incident_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
      }

      const rows = await DisciplinaryCase.findAll({ where });
      const bySanction = {};
      const byStatus = {};
      rows.forEach((r) => {
        if (r.sanction_level) bySanction[r.sanction_level] = (bySanction[r.sanction_level] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      });

      res.json({ success: true, data: { total: rows.length, by_sanction: bySanction, by_status: byStatus } });
    } catch (err) {
      next(err);
    }
  },

  async document(req, res, next) {
    try {
      const type = DOCUMENT_TITLES[req.query.type] ? req.query.type : 'veli_tebligati';
      const row = await DisciplinaryCase.findByPk(req.params.id, {
        include: [
          {
            model: Student,
            include: [
              { model: Classroom, required: false },
              { model: School, required: false },
            ],
            required: false,
          },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const student = row.Student;
      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-${row.id}.pdf"`);
      doc.pipe(res);

      const schoolName = student?.School?.name || 'Okul Müdürlüğü';
      doc.fontSize(13).text(schoolName.toUpperCase(), { align: 'center' });
      doc.fontSize(13).text(DOCUMENT_TITLES[type], { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(11);
      doc.font('Helvetica-Bold').text('Öğrenci: ', { continued: true });
      doc.font('Helvetica').text(student ? `${student.first_name} ${student.last_name}` : '—');
      doc.font('Helvetica-Bold').text('Sınıf: ', { continued: true });
      doc.font('Helvetica').text(student?.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : '—');
      doc.font('Helvetica-Bold').text('Olay Tarihi: ', { continued: true });
      doc.font('Helvetica').text(row.incident_date);
      doc.moveDown(1);
      doc.font('Helvetica-Bold').text('Olay Açıklaması:');
      doc.font('Helvetica').text(row.description, { align: 'justify' });

      doc.moveDown(2);
      const bodyMap = {
        veli_tebligati: 'Yukarıda belirtilen olay hakkında bilgi sahibi olmanız için işbu tebligat düzenlenmiştir.',
        savunma_istemi:
          'Yukarıda belirtilen olayla ilgili yazılı savunmanızın en geç 5 (beş) iş günü içinde okul idaresine sunulması istenmektedir.',
        karar_bildirimi: `Disiplin kurulu değerlendirmesi sonucunda alınan karar: ${row.decision_summary || row.sanction_level ? SANCTION_LABELS[row.sanction_level] || '' : 'Değerlendirme sürüyor'}.`,
      };
      doc.text(bodyMap[type], { align: 'justify' });

      doc.moveDown(4);
      doc.text(`Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' });
      doc.moveDown(2);
      doc.text('Okul Müdürü', { align: 'right' });

      await audit.log(req, {
        action: 'export',
        entityType: 'disciplinary_document',
        entityId: row.id,
        summary: `${DOCUMENT_TITLES[type]} üretildi (#${row.id})`,
      });

      doc.end();
    } catch (err) {
      next(err);
    }
  },
};
