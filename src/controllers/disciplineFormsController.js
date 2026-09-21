'use strict';

const {
  DisciplineStatement,
  DisciplineInfoRequest,
  DisciplineMeetingNotice,
  DisciplineParticipant,
  DisciplineIncident,
  Student,
  Classroom,
  School,
} = require('../models');
const audit = require('../services/auditService');
const { buildDisciplineDocx } = require('../services/disciplineDocumentService');

const STATEMENT_TITLES = {
  magdur: { yazili_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU MAĞDUR ÖĞRENCİNİN İFADESİ', sozlu_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU SÖZLÜ İFADE ve SAVUNMA TUTANAĞI' },
  suclanan: { yazili_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU ÖĞRENCİ İFADESİ', sozlu_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU SÖZLÜ İFADE ve SAVUNMA TUTANAĞI' },
  tanik: { yazili_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU GÖRGÜ TANIĞI İFADESİ', sozlu_ifade: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU SÖZLÜ İFADE ve SAVUNMA TUTANAĞI' },
};

const INFO_TITLES = {
  ogretmen: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BİLGİ TOPLAMA FORMU (ÖĞRETMEN)',
  rehberlik: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BİLGİ TOPLAMA FORMU (REHBERLİK)',
  arkadas: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BİLGİ TOPLAMA FORMU (ÖĞRENCİ)',
  genel: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BİLGİ TOPLAMA FORMU',
};

const studentInclude = {
  model: Student,
  include: [{ model: Classroom, attributes: ['id', 'class_level', 'section'], required: false }],
  required: false,
};

function classroomLabel(student) {
  if (!student) return '—';
  if (student.Classroom) return `${student.Classroom.class_level}/${student.Classroom.section}`;
  if (student.class_level) return `${student.class_level}${student.section ? '/' + student.section : ''}`;
  return '—';
}

async function loadParticipantContext(participantId) {
  const participant = await DisciplineParticipant.findByPk(participantId, {
    include: [
      studentInclude,
      { model: DisciplineIncident, as: 'Incident', include: [{ model: School, attributes: ['id', 'name'], required: false }] },
    ],
  });
  if (!participant) return null;
  return {
    participant,
    student: participant.Student,
    incident: participant.Incident,
    schoolName: participant.Incident && participant.Incident.School ? participant.Incident.School.name : 'Okul Müdürlüğü',
  };
}

function assertTenantAccess(req, incident) {
  if (!incident) return false;
  if (req.user && req.user.tenant_id && incident.tenant_id !== req.user.tenant_id) return false;
  return true;
}

module.exports = {
  // ---- Statements (ifade / sözlü ifade / savunma) ----
  async listStatements(req, res, next) {
    try {
      const where = {};
      if (req.query.incident_id) where.incident_id = Number(req.query.incident_id);
      if (req.query.participant_id) where.participant_id = Number(req.query.participant_id);
      const rows = await DisciplineStatement.findAll({
        where,
        include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createStatement(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const ctx = await loadParticipantContext(payload.participant_id);
      if (!ctx) return res.status(400).json({ success: false, message: 'Katılımcı bulunamadı' });
      if (!assertTenantAccess(req, ctx.incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const row = await DisciplineStatement.create({ ...payload, incident_id: ctx.incident.id });
      const full = await DisciplineStatement.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }] });
      await audit.log(req, { action: 'create', entityType: 'discipline_statement', entityId: row.id, summary: `İfade/savunma tutanağı eklendi (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateStatement(req, res, next) {
    try {
      const row = await DisciplineStatement.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineStatement.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeStatement(req, res, next) {
    try {
      const row = await DisciplineStatement.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async statementDocument(req, res, next) {
    try {
      const row = await DisciplineStatement.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude, { model: DisciplineIncident, as: 'Incident', include: [{ model: School, attributes: ['id', 'name'], required: false }] }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const incident = row.Participant.Incident;
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const student = row.Participant.Student;
      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const role = row.Participant.role;
      const dateLabel = `Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

      let buffer;
      if (row.statement_type === 'savunma') {
        const questions = Array.isArray(row.questions) ? row.questions : [];
        buffer = await buildDisciplineDocx({
          schoolName,
          title: 'DİSİPLİN SORUŞTURMASI SAVUNMA FORMU',
          infoRows: [
            ['Öğrencinin Adı Soyadı', student ? `${student.first_name} ${student.last_name}` : '—'],
            ['Sınıfı / Numarası', student ? `${classroomLabel(student)} / ${student.student_number || ''}` : '—'],
            ['Ev Telefonu', row.student_home_phone],
            ['Cep Telefonu', row.student_mobile_phone],
            ['Ev Adresi', row.student_home_address],
            ['Velinin Adı Soyadı', student ? student.parent_name || student.father_name || student.mother_name : '—'],
            ['Veli İş Telefonu', row.guardian_work_phone],
            ['Veli Cep Telefonu', row.guardian_mobile_phone || student?.parent_phone],
            ['Veli İş Adresi', row.guardian_work_address],
            ['Savunmanın Alındığı Tarih / Yer', [row.taken_at, row.location].filter(Boolean).join(' - ')],
            ['Savunmayı Alan', row.taken_by],
          ],
          paragraphs: [
            'OLAY',
            incident.summary || incident.title,
            ...questions.map((q, i) => `${i + 1}- ${q.question}\n${q.answer || ''}`),
            'SAVUNMAMDIR',
            row.content || '',
          ],
          dateLabel,
          signatures: [{ name: student ? `${student.first_name} ${student.last_name}` : '—', label: 'İmza' }],
        });
      } else {
        const title = (STATEMENT_TITLES[role] && STATEMENT_TITLES[role][row.statement_type]) || 'İFADE TUTANAĞI';
        buffer = await buildDisciplineDocx({
          schoolName,
          title,
          infoRows: [
            ['Adı Soyadı', student ? `${student.first_name} ${student.last_name}` : '—'],
            ['Doğum Tarihi', student ? student.birth_date : '—'],
            ['Sınıfı, Numarası', student ? `${classroomLabel(student)} / ${student.student_number || ''}` : '—'],
          ],
          paragraphs: [
            `OLAY: ${incident.summary || incident.title}`,
            row.statement_type === 'sozlu_ifade' ? `${row.taken_at || ''} tarihinde ${row.location || ''} mekanında alınan ifadesinde:` : 'İFADE:',
            row.content || '',
          ],
          dateLabel,
          signatures:
            row.statement_type === 'sozlu_ifade'
              ? undefined
              : [{ name: '…………………………………', label: 'Adı Soyadı / İmza' }],
          signatureColumns:
            row.statement_type === 'sozlu_ifade'
              ? [
                  { label: 'İfadeyi Yazan', name: row.written_by },
                  { label: 'İfade Sahibi', name: student ? `${student.first_name} ${student.last_name}` : '—' },
                  { label: 'İfadeyi Alan', name: row.taken_by },
                ]
              : undefined,
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="ifade-${row.id}.docx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // ---- Info requests (bilgi toplama formları) ----
  async listInfoRequests(req, res, next) {
    try {
      const where = {};
      if (req.query.incident_id) where.incident_id = Number(req.query.incident_id);
      if (req.query.participant_id) where.participant_id = Number(req.query.participant_id);
      const rows = await DisciplineInfoRequest.findAll({
        where,
        include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createInfoRequest(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const ctx = await loadParticipantContext(payload.participant_id);
      if (!ctx) return res.status(400).json({ success: false, message: 'Katılımcı bulunamadı' });
      if (!assertTenantAccess(req, ctx.incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const row = await DisciplineInfoRequest.create({ ...payload, incident_id: ctx.incident.id });
      const full = await DisciplineInfoRequest.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }] });
      await audit.log(req, { action: 'create', entityType: 'discipline_info_request', entityId: row.id, summary: `Bilgi toplama formu eklendi (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateInfoRequest(req, res, next) {
    try {
      const row = await DisciplineInfoRequest.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineInfoRequest.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeInfoRequest(req, res, next) {
    try {
      const row = await DisciplineInfoRequest.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async infoRequestDocument(req, res, next) {
    try {
      const row = await DisciplineInfoRequest.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude, { model: DisciplineIncident, as: 'Incident', include: [{ model: School, attributes: ['id', 'name'], required: false }] }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const incident = row.Participant.Incident;
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const student = row.Participant.Student;
      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const content = row.content || {};
      const dateLabel = `Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

      const paragraphSections = {
        ogretmen: [
          ['Dersimdeki Tutumu', content.ders_tutum],
          ['Ders Dışı Faaliyetleri', content.ders_disi],
          ['Arkadaşları İle İlişkisi', content.arkadas_iliski],
        ],
        rehberlik: [
          ['Kişisel Özellikleri', content.kisisel],
          ['Sosyal Özellikleri', content.sosyal],
        ],
        arkadas: [
          ['Dersteki Davranışları', content.ders],
          ['Teneffüslerdeki Davranışları', content.teneffus],
          ['Okul Dışındaki Davranışları', content.okul_disi],
        ],
        genel: [
          ['Konu İle İlgili Bilgilerim', content.bilgi],
          ['Arkadaşım Hakkındaki Görüşlerim', content.arkadas_gorus],
        ],
      };
      const sections = paragraphSections[row.source_type] || [];

      const buffer = await buildDisciplineDocx({
        schoolName,
        title: INFO_TITLES[row.source_type] || INFO_TITLES.genel,
        infoRows: [
          ['Öğrenci', student ? `${student.first_name} ${student.last_name}` : '—'],
          ['Sınıfı / Numarası', student ? `${classroomLabel(student)} / ${student.student_number || ''}` : '—'],
          ['Bilgi Veren', row.source_name],
          row.source_branch ? ['Branşı', row.source_branch] : null,
        ].filter(Boolean),
        paragraphs: sections.flatMap(([label, value]) => [{ text: label, bold: true, after: 60 }, value || '']),
        dateLabel,
        signatures: [{ name: row.source_name || '…………………………………', label: 'İmza' }],
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="bilgi-toplama-${row.id}.docx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // ---- Meeting notices (çağrı pusulaları) ----
  async listMeetingNotices(req, res, next) {
    try {
      const where = {};
      if (req.query.incident_id) where.incident_id = Number(req.query.incident_id);
      const rows = await DisciplineMeetingNotice.findAll({
        where,
        include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude], required: false }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createMeetingNotice(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const incident = await DisciplineIncident.findByPk(req.body.incident_id || req.query.incident_id);
      if (!incident) return res.status(400).json({ success: false, message: 'Olay bulunamadı' });
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const row = await DisciplineMeetingNotice.create({ ...payload, incident_id: incident.id });
      const full = await DisciplineMeetingNotice.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude], required: false }] });
      await audit.log(req, { action: 'create', entityType: 'discipline_meeting_notice', entityId: row.id, summary: `Çağrı pusulası oluşturuldu (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateMeetingNotice(req, res, next) {
    try {
      const row = await DisciplineMeetingNotice.findByPk(req.params.id, { include: [{ model: DisciplineIncident }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.DisciplineIncident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.validatedBody || req.body);
      const full = await DisciplineMeetingNotice.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude], required: false }] });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeMeetingNotice(req, res, next) {
    try {
      const row = await DisciplineMeetingNotice.findByPk(req.params.id, { include: [{ model: DisciplineIncident }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.DisciplineIncident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async meetingNoticeDocument(req, res, next) {
    try {
      const row = await DisciplineMeetingNotice.findByPk(req.params.id, {
        include: [
          { model: DisciplineParticipant, as: 'Participant', include: [studentInclude], required: false },
          { model: DisciplineIncident, include: [{ model: School, attributes: ['id', 'name'], required: false }] },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const incident = row.DisciplineIncident;
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const dateLabel = `Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;
      let buffer;

      if (row.notice_type === 'ogrenciye_cagri') {
        const student = row.Participant && row.Participant.Student;
        buffer = await buildDisciplineDocx({
          schoolName,
          title: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU ÇAĞRI PUSULASI',
          infoRows: [
            ['Adı Soyadı', student ? `${student.first_name} ${student.last_name}` : '—'],
            ['Doğum Tarihi', student ? student.birth_date : '—'],
            ['Sınıfı, Numarası', student ? `${classroomLabel(student)} / ${student.student_number || ''}` : '—'],
            ['Toplantı Tarihi, Saati', [row.meeting_date, row.meeting_time].filter(Boolean).join(' - ')],
          ],
          paragraphs: [
            `Bir disiplin soruşturmasına esas olarak Okulumuz Ödül ve Disiplin Kurulu ${row.location || 'Toplantı Odası'}nda, çağrı tarihi ve saatinde hazır bulunmanızı rica ederim.`,
          ],
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Ödül ve Disiplin Kurulu Başkanı' }],
        });
      } else {
        const members = Array.isArray(row.board_members) ? row.board_members : [];
        buffer = await buildDisciplineDocx({
          schoolName,
          officialHeader: true,
          sayi: '520/',
          konu: 'Disiplin Kurulu Toplantısı',
          title: 'ÖDÜL VE DİSİPLİN KURULU ÜYELERİNE',
          paragraphs: [
            `${row.meeting_date || ''} tarihinde saat ${row.meeting_time || ''} da ${row.location || 'Toplantı Odası'}nda aşağıdaki gündem maddelerini görüşmek üzere Ödül ve Disiplin Kurulu Toplantısı yapılacaktır. Gereğini rica ederim.`,
            'GÜNDEM',
            row.agenda || '',
          ],
          table:
            members.length > 0
              ? { headers: ['Üye', 'Görevi', 'Bilgi Edindim - İmza'], rows: members.map((m) => [m.name || '', m.title || '', '']) }
              : undefined,
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Ödül ve Disiplin Kurulu Başkanı' }],
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="cagri-pusulasi-${row.id}.docx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
