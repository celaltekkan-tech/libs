'use strict';

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const {
  DisciplineIncident,
  DisciplineParticipant,
  DisciplineStatement,
  DisciplineInfoRequest,
  DisciplineMeetingNotice,
  DisciplineDecision,
  DisciplineNotification,
  Student,
  Classroom,
  School,
  User,
} = require('../models');
const audit = require('../services/auditService');
const { buildDisciplineDocx } = require('../services/disciplineDocumentService');

const SANCTION_LABELS = {
  uyari: 'Uyarı',
  kinama: 'Kınama',
  okuldan_kisa_sureli_uzaklastirma: 'Okuldan Kısa Süreli Uzaklaştırma',
  okuldan_uzun_sureli_uzaklastirma: 'Okuldan Uzun Süreli Uzaklaştırma',
  okul_degistirme: 'Okul Değiştirme',
};

const ROLE_LABELS = { magdur: 'Mağdur Öğrenci', suclanan: 'Suçlanan Öğrenci', tanik: 'Görgü Tanığı' };

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function classroomLabel(student) {
  if (!student) return '—';
  if (student.Classroom) return `${student.Classroom.class_level}/${student.Classroom.section}`;
  if (student.class_level) return `${student.class_level}${student.section ? '/' + student.section : ''}`;
  return '—';
}

const studentInclude = {
  model: Student,
  attributes: ['id', 'first_name', 'last_name', 'student_number', 'national_id', 'birth_date', 'boarding_status'],
  include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
  required: false,
};

const participantInclude = { model: DisciplineParticipant, as: 'Participants', include: [studentInclude] };

module.exports = {
  SANCTION_LABELS,
  ROLE_LABELS,

  async list(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.school_id) where.school_id = Number(req.query.school_id);
      if (req.query.status) where.status = req.query.status;
      if (req.query.academic_year) where.academic_year = req.query.academic_year;

      const rows = await DisciplineIncident.findAll({
        where,
        include: [participantInclude, { model: School, attributes: ['id', 'name'], required: false }],
        order: [['incident_date', 'DESC'], ['id', 'DESC']],
        limit: 2000,
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async stats(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (req.query.academic_year) where.academic_year = req.query.academic_year;

      const incidents = await DisciplineIncident.findAll({ where, attributes: ['id', 'status', 'incident_date'] });
      const byStatus = {};
      const byMonth = {};
      incidents.forEach((inc) => {
        byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
        const month = String(inc.incident_date).slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });

      const incidentIds = incidents.map((i) => i.id);
      const decisionWhere = incidentIds.length ? { incident_id: { [Op.in]: incidentIds } } : { incident_id: -1 };
      const decisions = await DisciplineDecision.findAll({ where: decisionWhere, attributes: ['id', 'sanction_type', 'status'] });
      const bySanction = {};
      decisions.forEach((d) => {
        if (d.sanction_type) bySanction[d.sanction_type] = (bySanction[d.sanction_type] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          total_incidents: incidents.length,
          total_decisions: decisions.length,
          by_status: byStatus,
          by_month: byMonth,
          by_sanction: bySanction,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async sanctionedStudents(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const incidentWhere = {};
      if (tenantId) incidentWhere.tenant_id = tenantId;
      if (req.query.academic_year) incidentWhere.academic_year = req.query.academic_year;

      const decisions = await DisciplineDecision.findAll({
        include: [
          {
            model: DisciplineParticipant,
            as: 'Participant',
            required: true,
            include: [studentInclude],
          },
          { model: DisciplineIncident, required: true, where: incidentWhere, attributes: ['id', 'incident_code', 'title', 'incident_date'] },
        ],
        where: req.query.sanction_type ? { sanction_type: req.query.sanction_type } : undefined,
        order: [['decision_date', 'DESC']],
        limit: 2000,
      });

      const byStudent = new Map();
      decisions.forEach((d) => {
        const student = d.Participant && d.Participant.Student;
        if (!student) return;
        const key = student.id;
        if (!byStudent.has(key)) {
          byStudent.set(key, { student, decisions: [] });
        }
        byStudent.get(key).decisions.push({
          id: d.id,
          sanction_type: d.sanction_type,
          decision_date: d.decision_date,
          status: d.status,
          incident: d.DisciplineIncident,
        });
      });

      res.json({ success: true, data: [...byStudent.values()] });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await DisciplineIncident.findByPk(req.params.id, {
        include: [
          participantInclude,
          { model: School, attributes: ['id', 'name'], required: false },
          { model: User, as: 'CreatedBy', attributes: ['id', 'full_name'], required: false },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payload = { ...(req.validatedBody || req.body) };
      const tenantId = req.user && req.user.tenant_id;
      if (tenantId) payload.tenant_id = tenantId;
      payload.academic_year = currentAcademicYear();
      payload.created_by = req.user && req.user.user_id;

      const count = await DisciplineIncident.count({ where: { tenant_id: payload.tenant_id, school_id: payload.school_id } });
      payload.incident_code = `OLAY${String(count + 1).padStart(3, '0')}`;

      const row = await DisciplineIncident.create(payload);
      const full = await DisciplineIncident.findByPk(row.id, { include: [participantInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'discipline_incident',
        entityId: row.id,
        summary: `Disiplin olayı açıldı: ${row.incident_code} - ${row.title}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await DisciplineIncident.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineIncident.findByPk(row.id, { include: [participantInclude] });
      await audit.log(req, {
        action: 'update',
        entityType: 'discipline_incident',
        entityId: row.id,
        summary: `Disiplin olayı güncellendi: ${row.incident_code}`,
      });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await DisciplineIncident.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      const code = row.incident_code;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'discipline_incident',
        entityId: req.params.id,
        summary: `Disiplin olayı silindi: ${code}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async addParticipant(req, res, next) {
    try {
      const incident = await DisciplineIncident.findByPk(req.params.id);
      if (!incident) return res.status(404).json({ success: false, message: 'Olay bulunamadı' });
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { student_id, role } = req.validatedBody || req.body;
      const student = await Student.findByPk(student_id);
      if (!student || (incident.tenant_id && student.tenant_id !== incident.tenant_id)) {
        return res.status(400).json({ success: false, message: 'Seçilen öğrenci bulunamadı' });
      }

      const existing = await DisciplineParticipant.findOne({ where: { incident_id: incident.id, student_id } });
      if (existing) return res.status(409).json({ success: false, message: 'Bu öğrenci zaten bu olaya eklenmiş' });

      const row = await DisciplineParticipant.create({ incident_id: incident.id, student_id, role });
      const full = await DisciplineParticipant.findByPk(row.id, { include: [studentInclude] });
      await audit.log(req, {
        action: 'create',
        entityType: 'discipline_participant',
        entityId: row.id,
        summary: `Olaya öğrenci eklendi (${incident.incident_code}): ${student.first_name} ${student.last_name}`,
      });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateParticipant(req, res, next) {
    try {
      const row = await DisciplineParticipant.findByPk(req.params.participantId, { include: [{ model: DisciplineIncident, as: 'Incident' }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineParticipant.findByPk(row.id, { include: [studentInclude] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeParticipant(req, res, next) {
    try {
      const row = await DisciplineParticipant.findByPk(req.params.participantId, { include: [{ model: DisciplineIncident, as: 'Incident' }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async excelPreview(req, res, next) {
    try {
      const incident = await DisciplineIncident.findByPk(req.params.id);
      if (!incident) return res.status(404).json({ success: false, message: 'Olay bulunamadı' });
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      if (!req.file) return res.status(400).json({ success: false, message: 'Excel dosyası yüklenmedi' });

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const tenantId = req.user && req.user.tenant_id;
      // school_id ile filtrelemiyoruz: bu alan geriye dönük öğrenci kayıtlarında boş
      // kalabiliyor (sınıf ataması asıl kaynak). Kullanıcı zaten commit öncesi
      // önizleme tablosunda ad/sınıf eşleşmesini gözden geçiriyor.
      const students = await Student.findAll({
        where: { tenant_id: tenantId },
        include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
      });
      const byNumber = new Map(students.filter((s) => s.student_number).map((s) => [String(s.student_number).trim(), s]));
      const byNationalId = new Map(students.filter((s) => s.national_id).map((s) => [String(s.national_id).trim(), s]));

      const existingParticipants = await DisciplineParticipant.findAll({ where: { incident_id: incident.id } });
      const existingStudentIds = new Set(existingParticipants.map((p) => p.student_id));

      const rows = raw.map((r, idx) => {
        const numberKey = String(r['Okul Numarası'] ?? r['okul numarası'] ?? r['Numara'] ?? r['numara'] ?? '').trim();
        const nationalIdKey = String(r['TC Kimlik No'] ?? r['tc kimlik no'] ?? r['TC'] ?? '').trim();
        const student = (numberKey && byNumber.get(numberKey)) || (nationalIdKey && byNationalId.get(nationalIdKey));
        return {
          row_index: idx,
          input_number: numberKey,
          input_national_id: nationalIdKey,
          student_id: student ? student.id : null,
          full_name: student ? `${student.first_name} ${student.last_name}` : r['Adı Soyadı'] || r['adı soyadı'] || '',
          classroom: student ? classroomLabel(student) : '',
          already_added: student ? existingStudentIds.has(student.id) : false,
          role: 'suclanan',
          matched: !!student,
        };
      });

      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async excelCommit(req, res, next) {
    try {
      const incident = await DisciplineIncident.findByPk(req.params.id);
      if (!incident) return res.status(404).json({ success: false, message: 'Olay bulunamadı' });
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const { rows } = req.validatedBody || req.body;
      const existing = await DisciplineParticipant.findAll({ where: { incident_id: incident.id } });
      const existingStudentIds = new Set(existing.map((p) => p.student_id));

      const toCreate = rows.filter((r) => !existingStudentIds.has(r.student_id));
      if (toCreate.length > 0) {
        await DisciplineParticipant.bulkCreate(
          toCreate.map((r) => ({ incident_id: incident.id, student_id: r.student_id, role: r.role }))
        );
      }

      await audit.log(req, {
        action: 'create',
        entityType: 'discipline_participant',
        entityId: incident.id,
        summary: `Excel ile toplu öğrenci eklendi (${incident.incident_code}): ${toCreate.length} kayıt`,
      });

      const full = await DisciplineIncident.findByPk(incident.id, { include: [participantInclude] });
      res.json({ success: true, data: full, created: toCreate.length, skipped: rows.length - toCreate.length });
    } catch (err) {
      next(err);
    }
  },

  async document(req, res, next) {
    try {
      const type = req.query.type || 'sikayet_dilekcesi';
      const incident = await DisciplineIncident.findByPk(req.params.id, {
        include: [participantInclude, { model: School, attributes: ['id', 'name'], required: false }],
      });
      if (!incident) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const dateLabel = `Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;
      let buffer;
      let filename = `${type}-${incident.id}.docx`;

      if (type === 'sikayet_dilekcesi') {
        buffer = await buildDisciplineDocx({
          schoolName,
          title: `${String(schoolName).toUpperCase()} MÜDÜRLÜĞÜNE`,
          paragraphs: [incident.summary || incident.title],
          infoRows: [
            ['Dilekçeyi Veren Kişi', incident.complainant_name],
            ['Dilekçe Tarih / Sayı', [incident.complaint_ref_date, incident.complaint_ref_no].filter(Boolean).join(' - ')],
          ],
          dateLabel,
          signatures: [{ name: incident.complainant_name || '…………………………………', label: 'İmza' }],
        });
      } else if (type === 'bildirim_tutanagi') {
        buffer = await buildDisciplineDocx({
          schoolName,
          title: 'TUTANAKTIR',
          infoRows: [
            ['Olay Kodu', incident.incident_code],
            ['Olay Adı', incident.title],
            ['Tarih / Saat', `${incident.incident_date} ${incident.incident_time || ''}`.trim()],
            ['Yer', incident.location],
          ],
          paragraphs: [incident.summary || ''],
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Ödül ve Disiplin Kurulu Başkanı' }],
        });
      } else if (type === 'sinif_kontrol_formu') {
        buffer = await buildDisciplineDocx({
          schoolName,
          title: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU DİSİPLİN BİLDİRİM FORMU',
          infoRows: [
            ['Kontrol Tarihi', incident.incident_date],
            ['Kontrol Yeri', incident.location],
            ['Olay', incident.title],
          ],
          table: {
            headers: ['Adı Soyadı', 'Sınıfı / No', 'Problemi Oluşturma Şekli'],
            rows: (incident.Participants || []).map((p) => [
              p.Student ? `${p.Student.first_name} ${p.Student.last_name}` : '—',
              p.Student ? `${classroomLabel(p.Student)} / ${p.Student.student_number || ''}` : '—',
              incident.summary || '',
            ]),
          },
          dateLabel,
        });
      } else if (type === 'dizi_pusulasi') {
        const [statementCount, infoCount, meetingCount, decisionCount] = await Promise.all([
          DisciplineStatement.count({ where: { incident_id: incident.id } }),
          DisciplineInfoRequest.count({ where: { incident_id: incident.id } }),
          DisciplineMeetingNotice.count({ where: { incident_id: incident.id } }),
          DisciplineDecision.count({ where: { incident_id: incident.id } }),
        ]);
        buffer = await buildDisciplineDocx({
          schoolName,
          title: 'DİZİ PUSULASI',
          infoRows: [['Olay', `${incident.incident_code} - ${incident.title}`]],
          table: {
            headers: ['Belge', 'Durum'],
            rows: [
              ['Olay Tutanağı / Şikayet Dilekçesi', 'Var'],
              ['İfade Tutanakları', statementCount > 0 ? `Var (${statementCount})` : 'Yok'],
              ['Bilgi Toplama Formları', infoCount > 0 ? `Var (${infoCount})` : 'Yok'],
              ['Çağrı Pusulaları / Toplantı Çağrıları', meetingCount > 0 ? `Var (${meetingCount})` : 'Yok'],
              ['Ödül ve Disiplin Kurulu Kararı', decisionCount > 0 ? `Var (${decisionCount})` : 'Yok'],
            ],
          },
          dateLabel,
        });
      } else if (type === 'ek_sure_talebi') {
        let reasons = [];
        try {
          reasons = req.query.reasons ? JSON.parse(req.query.reasons) : [];
        } catch {
          reasons = [];
        }
        if (!Array.isArray(reasons)) reasons = [];
        buffer = await buildDisciplineDocx({
          schoolName,
          title: `${String(schoolName).toUpperCase()} MÜDÜRLÜĞÜNE`,
          paragraphs: [
            `${incident.incident_date} tarihinde Ödül ve Disiplin Kurulu Başkanlığına intikal eden ${incident.title} dosyasını incelemek ve karar vermek için, aşağıda yazılı nedenlerden dolayı ek süre verilmesini talep ediyorum.`,
            'Ek Süre İstenmesinin Nedenleri:',
            ...reasons.map((r, i) => `${i + 1}- ${r}`),
          ],
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Ödül ve Disiplin Kurulu Başkanı' }],
        });
      } else {
        return res.status(400).json({ success: false, message: 'Geçersiz belge türü' });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      await audit.log(req, {
        action: 'export',
        entityType: 'discipline_document',
        entityId: incident.id,
        summary: `Belge üretildi (${incident.incident_code}): ${type}`,
      });
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
