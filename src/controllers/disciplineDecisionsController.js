'use strict';

const {
  DisciplineDecision,
  DisciplineNotification,
  DisciplineParticipant,
  DisciplineIncident,
  DisciplineRegulationArticle,
  DisciplineBehaviorPoint,
  Student,
  Classroom,
  School,
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

const SANCTION_BEHAVIOR_POINTS = {
  uyari: 5,
  kinama: 10,
  okuldan_kisa_sureli_uzaklastirma: 20,
  okuldan_uzun_sureli_uzaklastirma: 30,
  okul_degistirme: 40,
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

function assertTenantAccess(req, incident) {
  if (!incident) return false;
  if (req.user && req.user.tenant_id && incident.tenant_id !== req.user.tenant_id) return false;
  return true;
}

const participantWithIncident = {
  model: DisciplineParticipant,
  as: 'Participant',
  include: [studentInclude, { model: DisciplineIncident, as: 'Incident', include: [{ model: School, attributes: ['id', 'name'], required: false }] }],
};

module.exports = {
  SANCTION_LABELS,

  // ---- Ceza Verme Kararı ----
  async listDecisions(req, res, next) {
    try {
      const where = {};
      if (req.query.incident_id) where.incident_id = Number(req.query.incident_id);
      if (req.query.participant_id) where.participant_id = Number(req.query.participant_id);
      if (req.query.status) where.status = req.query.status;
      const rows = await DisciplineDecision.findAll({
        where,
        include: [participantWithIncident, { model: DisciplineRegulationArticle, as: 'RegulationArticle', required: false }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createDecision(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const participant = await DisciplineParticipant.findByPk(payload.participant_id, { include: [{ model: DisciplineIncident, as: 'Incident' }] });
      if (!participant) return res.status(400).json({ success: false, message: 'Katılımcı bulunamadı' });
      if (!assertTenantAccess(req, participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const row = await DisciplineDecision.create({ ...payload, incident_id: participant.incident_id });

      if (row.status === 'onaylandi' && row.sanction_type) {
        const incident = participant.Incident;
        await DisciplineBehaviorPoint.create({
          tenant_id: incident.tenant_id,
          student_id: participant.student_id,
          participant_id: participant.id,
          decision_id: row.id,
          academic_year: incident.academic_year,
          points_deducted: SANCTION_BEHAVIOR_POINTS[row.sanction_type] || 0,
          points_restored: 0,
          reason: `${SANCTION_LABELS[row.sanction_type] || row.sanction_type} cezası (${incident.incident_code})`,
        });
      }

      const full = await DisciplineDecision.findByPk(row.id, { include: [participantWithIncident, { model: DisciplineRegulationArticle, as: 'RegulationArticle', required: false }] });
      await audit.log(req, { action: 'create', entityType: 'discipline_decision', entityId: row.id, summary: `Disiplin kararı oluşturuldu (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateDecision(req, res, next) {
    try {
      const row = await DisciplineDecision.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const payload = req.validatedBody || req.body;
      const wasApproved = row.status === 'onaylandi';
      await row.update(payload);

      if (!wasApproved && row.status === 'onaylandi' && row.sanction_type) {
        const participant = row.Participant;
        const incident = participant.Incident;
        await DisciplineBehaviorPoint.create({
          tenant_id: incident.tenant_id,
          student_id: participant.student_id,
          participant_id: participant.id,
          decision_id: row.id,
          academic_year: incident.academic_year,
          points_deducted: SANCTION_BEHAVIOR_POINTS[row.sanction_type] || 0,
          points_restored: 0,
          reason: `${SANCTION_LABELS[row.sanction_type] || row.sanction_type} cezası (${incident.incident_code})`,
        });
      }

      const full = await DisciplineDecision.findByPk(row.id, { include: [participantWithIncident, { model: DisciplineRegulationArticle, as: 'RegulationArticle', required: false }] });
      await audit.log(req, { action: 'update', entityType: 'discipline_decision', entityId: row.id, summary: `Disiplin kararı güncellendi (#${row.id})` });
      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async removeDecision(req, res, next) {
    try {
      const row = await DisciplineDecision.findByPk(req.params.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.Participant && row.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async decisionDocument(req, res, next) {
    try {
      const row = await DisciplineDecision.findByPk(req.params.id, {
        include: [participantWithIncident, { model: DisciplineRegulationArticle, as: 'RegulationArticle', required: false }],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const incident = row.Participant.Incident;
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const student = row.Participant.Student;
      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const members = Array.isArray(row.board_members) ? row.board_members : [];
      const articleText = row.regulation_article_text || (row.RegulationArticle ? `Madde ${row.RegulationArticle.article_no} - ${row.RegulationArticle.title}` : '');

      const buffer = await buildDisciplineDocx({
        schoolName,
        title: 'OKUL ÖDÜL ve DİSİPLİN KURULU KARARI',
        infoRows: [
          ['Karar No', row.decision_no],
          ['Karar Tarihi', row.decision_date],
          ['Adı Soyadı', student ? `${student.first_name} ${student.last_name}` : '—'],
          ['Doğum Tarihi', student ? student.birth_date : '—'],
          ['Sınıfı, Numarası', student ? `${classroomLabel(student)} / ${student.student_number || ''}` : '—'],
          ['Paralı/Parasız Yatılı ya da Gündüzlü', student ? student.boarding_status : '—'],
          ['Ailesinin Ekonomik Durumu', [row.Participant.economic_status_mother, row.Participant.economic_status_father].filter(Boolean).join(' / ')],
          ['Sağlık Durumu', row.Participant.health_status],
          ['Şimdiye Kadar Aldığı Cezalar', row.prior_sanctions_summary],
          ['Cezayı Gerektiren Davranışın Yeri ve Tarihi', [row.behavior_place, row.behavior_date].filter(Boolean).join(' - ')],
          ['Cezayı Gerektiren Davranışın Çeşidi', row.behavior_type],
          ['Cezayı Gerektiren Davranışın Nedeni', row.behavior_reason],
        ],
        paragraphs: [
          { text: 'İfade ve Delillerin Özeti', bold: true, after: 60 },
          row.statements_summary || '',
          { text: 'Ceza Takdirinde Hafifletici / Ağırlaştırıcı Nedenler', bold: true, after: 60 },
          row.mitigating_aggravating_factors || '',
          { text: 'Ödül ve Disiplin Kurulunun Kanaati', bold: true, after: 60 },
          row.board_opinion || '',
          { text: 'Dayanılan Yönetmelik Maddesi', bold: true, after: 60 },
          articleText,
          { text: 'Verilen Cezanın Çeşidi', bold: true, after: 60 },
          `${SANCTION_LABELS[row.sanction_type] || '—'}${row.sanction_days ? ` (${row.sanction_days} gün)` : ''}`,
          { text: 'Okul Öğrenci Ödül ve Disiplin Kurulunun Kararı', bold: true, after: 60 },
          row.board_decision || '',
        ],
        table: members.length > 0 ? { headers: members.map(() => 'Üye'), rows: [members.map((m) => `${m.name || ''}\n${m.title || ''}`)] } : undefined,
        dateLabel: `Onay Tarihi: ${row.approved_date || '—'}`,
        signatures: [{ name: row.approved_by || '…………………………………', label: 'Okul Müdürü - UYGUNDUR' }],
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="disiplin-karari-${row.id}.docx"`);
      await audit.log(req, { action: 'export', entityType: 'discipline_decision_document', entityId: row.id, summary: `Disiplin karar belgesi üretildi (#${row.id})` });
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // ---- Tebligatlar ----
  async listNotifications(req, res, next) {
    try {
      const where = {};
      if (req.query.decision_id) where.decision_id = Number(req.query.decision_id);
      if (req.query.participant_id) where.participant_id = Number(req.query.participant_id);
      const rows = await DisciplineNotification.findAll({
        where,
        include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }],
        order: [['id', 'DESC']],
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async createNotification(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const decision = await DisciplineDecision.findByPk(req.body.decision_id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] });
      if (!decision) return res.status(400).json({ success: false, message: 'Karar bulunamadı' });
      if (!assertTenantAccess(req, decision.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const row = await DisciplineNotification.create({ ...payload, decision_id: decision.id });
      const full = await DisciplineNotification.findByPk(row.id, { include: [{ model: DisciplineParticipant, as: 'Participant', include: [studentInclude] }] });
      await audit.log(req, { action: 'create', entityType: 'discipline_notification', entityId: row.id, summary: `Tebligat oluşturuldu (#${row.id})` });
      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },

  async updateNotification(req, res, next) {
    try {
      const row = await DisciplineNotification.findByPk(req.params.id, { include: [{ model: DisciplineDecision, include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.DisciplineDecision.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.update(req.body);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },

  async removeNotification(req, res, next) {
    try {
      const row = await DisciplineNotification.findByPk(req.params.id, { include: [{ model: DisciplineDecision, include: [{ model: DisciplineParticipant, as: 'Participant', include: [{ model: DisciplineIncident, as: 'Incident' }] }] }] });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (!assertTenantAccess(req, row.DisciplineDecision.Participant.Incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      await row.destroy();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async notificationDocument(req, res, next) {
    try {
      const row = await DisciplineNotification.findByPk(req.params.id, {
        include: [
          { model: DisciplineParticipant, as: 'Participant', include: [studentInclude, { model: DisciplineIncident, as: 'Incident', include: [{ model: School, attributes: ['id', 'name'], required: false }] }] },
          { model: DisciplineDecision },
        ],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      const incident = row.Participant.Incident;
      if (!assertTenantAccess(req, incident)) return res.status(403).json({ success: false, message: 'Erişim reddedildi' });

      const student = row.Participant.Student;
      const schoolName = incident.School ? incident.School.name : 'Okul Müdürlüğü';
      const decision = row.DisciplineDecision;
      const sanctionLabel = decision ? SANCTION_LABELS[decision.sanction_type] || decision.sanction_type : '—';
      const dateLabel = `Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;
      let buffer;

      if (row.notification_type === 'ogrenciye_ceza_bildirimi') {
        buffer = await buildDisciplineDocx({
          schoolName,
          officialHeader: true,
          sayi: '520/',
          konu: 'Ceza Bildirimi',
          title: `(${classroomLabel(student)} Sınıfı ${student ? student.student_number || '' : ''} Numaralı Öğrencisi)`,
          addressee: `Sn; ${student ? `${student.first_name} ${student.last_name}` : ''}`,
          paragraphs: [
            `${incident.incident_date} tarihinde ${incident.location || ''} mekanında meydana gelen ${incident.title} olayınız tespit edilmiş olup bu davranışınız ile ilgili olarak Okul Öğrenci Ödül ve Disiplin Kurulunun vermiş olduğu "${sanctionLabel}" cezası tarafınıza bildirilmiştir.`,
            'Okul içinde ve dışında daha kötü sonuçlar doğurabilecek davranışlara yönelmemenizi önerir, bundan sonra yapacağınız her olumsuz davranıştan dolayı cezanızın ağırlaşacağını bilmenizi önemle bilgilerinize sunarım.',
          ],
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Okul Müdürü' }],
        });
      } else if (row.notification_type === 'veliye_bildirim') {
        buffer = await buildDisciplineDocx({
          schoolName,
          officialHeader: true,
          sayi: '520/',
          konu: 'Disiplin Duyurusu',
          addressee: `Sayın: ${student ? student.parent_name || student.father_name || student.mother_name || '' : ''} (Velisi)`,
          paragraphs: [
            `Velisi bulunduğunuz ${classroomLabel(student)} sınıfı ${student ? student.student_number || '' : ''} numaralı ${student ? `${student.first_name} ${student.last_name}` : ''}, aşağıda belirtilen uygunsuz davranışı yapması nedeniyle okulumuz "Öğrenci Ödül ve Disiplin Kurulu"nca suçlu bulunmuştur.`,
            'Bilgilerinize sunar, daha kötü sonuçlar doğurabilecek davranışlara yönelmesini önlemek için okul yönetimi ve öğretmenleri ile işbirliği yapmanızı önerir, bundan sonra yapacağı her olumsuz davranıştan dolayı cezasının ağırlaşacağını bilmenizi önemle bilgilerinize sunarım.',
          ],
          table: {
            headers: ['Cezayı Gerektiren Davranış', 'Verilen Ceza', 'Kırılan Davranış Notu', 'Kalan Davranış Notu'],
            rows: [[incident.title, sanctionLabel, String(row.broken_behavior_point ?? '—'), String(row.remaining_behavior_point ?? '—')]],
          },
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Okul Müdürü' }],
        });
      } else {
        buffer = await buildDisciplineDocx({
          schoolName,
          officialHeader: true,
          sayi: '520/',
          konu: 'Ceza Günü Bildirimi',
          title: `(${classroomLabel(student)} Sınıfı ${student ? student.student_number || '' : ''} Numaralı Öğrencisi)`,
          addressee: `Sn; ${student ? `${student.first_name} ${student.last_name}` : ''}`,
          paragraphs: [
            `Okul Ödül ve Disiplin Kurulunun vermiş olduğu ${decision?.sanction_days ?? ''} gün okuldan kısa süreli uzaklaştırma cezanız ${row.sanction_start_date || ''} - ${row.sanction_end_date || ''} tarihleri arasında uygulanacaktır. Bu tarihlerde okula gelmemeniz gerekmektedir.`,
            'Bilgilerinize sunar, daha kötü sonuçlar doğurabilecek davranışlara yönelmemenizi önerir, bundan sonra yapacağınız her olumsuz davranıştan dolayı cezanızın ağırlaşacağını bilmenizi önemle bilgilerinize sunarım.',
          ],
          dateLabel,
          signatures: [{ name: '…………………………………', label: 'Okul Müdürü' }],
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="tebligat-${row.id}.docx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
