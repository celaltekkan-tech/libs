'use strict';

const PDFDocument = require('pdfkit');
const { Teacher, School, PersonnelCategory, sequelize } = require('../models');
const { Op } = require('sequelize');
const audit = require('../services/auditService');
const { sendTableExport } = require('../services/exportService');
const { parseMebbisWorkbook } = require('../services/mebbisImportService');
const { ensureDefaultCategories } = require('./personnelCategoriesController');
const { registerUnicodeFonts } = require('../utils/pdfFonts');
const { buildPersonnelDocumentDocx } = require('../services/personnelDocumentService');
const { applyTitleFields, titleFieldsFromMebbisRow } = require('../utils/teacherTitle');
const { ensureSubjectFromTeacher, ensureSubjectsForBranches, branchFromTeacher } = require('../services/subjectFromBranchService');
const { resolvePrincipalName } = require('../services/schoolPrincipalService');

const PERSONNEL_DOCUMENT_TITLES = {
  gorevlendirme: 'GÖREVLENDİRME YAZISI',
  baslama: 'GÖREVE BAŞLAMA YAZISI',
  ayrilis: 'AYRILIŞ YAZISI',
};

const COLUMN_LABELS = {
  first_name: 'Ad',
  last_name: 'Soyad',
  school_name: 'Okul',
  city: 'Şehir',
  district: 'İlçe',
  personnel_no: 'Sicil No',
  national_id: 'T.C. Kimlik No',
  phone: 'Cep telefonu',
  email: 'E-posta',
  unvan: 'Unvan',
  brans: 'Branş',
  kariyer: 'Kariyer',
  title_branch: 'Unvan / Branş',
  working_institution: 'Görev Yeri',
  degree: 'Derece',
  rank: 'Kademe',
  pension_degree: 'Emekli Sicil No',
  degree_rank_date: 'Kademe Tarihi',
  degree_rank_anchor_date: 'Kademe ilerleme esas tarihi',
  last_graduated_school: 'Mezun Olunan Okul',
  birth_date: 'Doğum Tarihi',
  class_level: 'Sınıf / Kademe',
  school_principal: 'Okul Müdürü',
  union_name: 'Sendika',
  first_duty_date: 'İşe ilk başlama tarihi',
  service_start_date: 'Kuruma başlama tarihi',
  annual_leave_quota: 'Yıllık izin hakkı (gün)',
  eight_year_base_date: '8 yıllık terfi esas tarihi',
  personnel_type: 'Personel türü',
  contract_start_date: 'Sözleşme başlangıcı',
  contract_end_date: 'Sözleşme bitişi',
  kurum_kodu: 'Kurum kodu',
  ogrenim_durumu: 'Öğrenim durumu',
  arsiv_no: 'Arşiv no',
  cinsiyet: 'Cinsiyet',
  kan_grubu: 'Kan grubu',
  durum: 'Durum',
  seviye_unvani: 'Seviye unvanı',
};

const DEFAULT_COLUMNS = Object.keys(COLUMN_LABELS);

const DATE_COLUMNS = new Set([
  'birth_date',
  'degree_rank_date',
  'degree_rank_anchor_date',
  'eight_year_base_date',
  'first_duty_date',
  'service_start_date',
  'contract_start_date',
  'contract_end_date',
]);

const META_COLUMNS = new Set([
  'kurum_kodu',
  'ogrenim_durumu',
  'arsiv_no',
  'cinsiyet',
  'kan_grubu',
  'durum',
  'seviye_unvani',
]);

const PERSONNEL_TYPE_LABELS = {
  ogretmen: 'Öğretmen',
  memur: 'Memur',
  isci: 'İşçi',
  typ: 'TYP',
  diger: 'Diğer',
};

function applyPersonnelScope(where, query = {}) {
  const categoryId = query.category_id != null ? Number(query.category_id) : null;
  if (categoryId) {
    where.personnel_category_id = categoryId;
    return;
  }
  const scope = String(query.scope || 'all');
  if (scope === 'teachers') {
    where.personnel_type = 'ogretmen';
    where.personnel_category_id = null;
  } else if (scope === 'staff') {
    where[Op.or] = [
      { personnel_type: { [Op.ne]: 'ogretmen' } },
      { personnel_category_id: { [Op.ne]: null } },
    ];
  }
}

async function applyCategoryToPayload(payload, tenantId) {
  if (payload.personnel_category_id == null || payload.personnel_category_id === '') {
    return payload;
  }
  const category = await PersonnelCategory.findOne({
    where: { id: Number(payload.personnel_category_id), tenant_id: tenantId },
  });
  if (!category) {
    const err = new Error('Personel kategorisi bulunamadı');
    err.status = 400;
    throw err;
  }
  payload.personnel_category_id = category.id;
  payload.personnel_type = category.code || 'diger';
  return payload;
}

async function findCategoryByCode(tenantId, code) {
  if (!code || code === 'ogretmen' || code === 'diger') return null;
  return PersonnelCategory.findOne({ where: { tenant_id: tenantId, code } });
}

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
      .includes(needle) ||
    String(teacher.unvan || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.brans || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.kariyer || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.union_name || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.phone || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle) ||
    String(teacher.email || '')
      .toLocaleLowerCase('tr-TR')
      .includes(needle)
  );
}

function normalizeTeacherContact(payload) {
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    const { assertValidMobilePhone } = require('../utils/phone');
    payload.phone = assertValidMobilePhone(payload.phone, { required: false });
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    const raw = payload.email == null ? '' : String(payload.email).trim().toLowerCase();
    payload.email = raw || null;
  }
  return payload;
}

function formatDateCell(value) {
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatTeacherCell(teacher, key) {
  if (key === 'school_name') return teacher.School?.name || '';
  if (META_COLUMNS.has(key)) {
    const meta = teacher.meta && typeof teacher.meta === 'object' ? teacher.meta : null;
    const metaValue = meta ? meta[key] : null;
    return metaValue == null || metaValue === '' ? '' : String(metaValue);
  }
  const value = teacher[key];
  if (value == null || value === '') return '';
  if (key === 'personnel_type') return PERSONNEL_TYPE_LABELS[value] || String(value);
  if (DATE_COLUMNS.has(key)) return formatDateCell(value);
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

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return match ? match[1] : null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function clampDateOnly(year, month, day) {
  const last = new Date(year, month, 0).getDate();
  const clamped = Math.min(day, last);
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

function daysBetweenIso(fromIso, toIso) {
  const start = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/** Bugün veya daha önceki son yıl dönümü. Taban tarihten önceyse yok sayılır. */
function lastAnniversary(baseIso, todayIso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso || '');
  if (!match || !todayIso) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const year = Number(todayIso.slice(0, 4));
  let candidate = clampDateOnly(year, month, day);
  if (candidate > todayIso) candidate = clampDateOnly(year - 1, month, day);
  if (candidate < baseIso) return null;
  return candidate;
}

/** Göreve ilk başlama (veya kademe) tarihinin, bugünden sonraki ilk yıl dönümü. */
function nextAnniversary(baseIso, from = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso || '');
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const fromIso = toDateOnly(from);
  let year = Number(fromIso.slice(0, 4));
  let candidate = clampDateOnly(year, month, day);
  if (candidate < fromIso) candidate = clampDateOnly(year + 1, month, day);
  return candidate;
}

function anniversaryInPeriod(baseIso, period) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso || '');
  if (!match || !period) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const startIso = toDateOnly(period.start);
  const endIso = toDateOnly(new Date(period.endExclusive.getTime() - 86400000));
  const startYear = Number(startIso.slice(0, 4));
  const endYear = Number(endIso.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    const candidate = clampDateOnly(year, month, day);
    if (candidate >= startIso && candidate <= endIso) return candidate;
  }
  return null;
}

function splitIlIlce(ilIlce) {
  const parts = String(ilIlce || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  return { city: parts[0] || null, district: parts[1] || null };
}

function buildTeacherPayloadFromMebbisRow(row, tenantId, schoolId) {
  const { city, district } = splitIlIlce(row.il_ilce);
  const titleFields = titleFieldsFromMebbisRow(row);
  return {
    tenant_id: tenantId,
    school_id: schoolId,
    city,
    district,
    personnel_no: row.kurum_sicil_no || null,
    national_id: row.national_id || null,
    first_name: row.first_name,
    last_name: row.last_name,
    birth_date: row.dogum_tarihi || null,
    ...titleFields,
    working_institution: row.kurum_adi || null,
    pension_degree: row.emekli_sicil_no || null,
    rank: row.kademe != null ? String(row.kademe) : null,
    degree: row.derece != null ? String(row.derece) : null,
    service_start_date: row.kurum_baslama_tarihi || null,
    first_duty_date: row.ilk_gorev_tarihi || null,
    personnel_type: row.personnel_type || 'ogretmen',
    union_name: row.union_name || null,
    meta: {
      il_ilce: row.il_ilce || null,
      kurum_kodu: row.kurum_kodu || null,
      ogrenim_durumu: row.ogrenim_durumu || null,
      arsiv_no: row.arsiv_no || null,
      cinsiyet: row.cinsiyet || null,
      kan_grubu: row.kan_grubu || null,
      dogum_tarihi: row.dogum_tarihi || null,
      ilk_gorev_tarihi: row.ilk_gorev_tarihi || null,
      durum: row.durum || null,
      seviye_unvani: row.seviye_unvani || null,
      mebbis_import_at: new Date().toISOString(),
    },
  };
}

module.exports = {
  COLUMN_LABELS,

  async importMebbisPreview(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Dosya yüklenmedi' });
      }
      const tenantId = req.user && req.user.tenant_id;
      const parsed = parseMebbisWorkbook(req.file.buffer);
      if (parsed.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Dosyada tanınabilir bir personel kaydı bulunamadı. MEBBİS "Personel Listesi Özet Bilgiler" dökümü olduğundan emin olun.',
        });
      }

      const nationalIds = parsed.map((r) => r.national_id).filter(Boolean);
      const existing = await Teacher.findAll({
        where: { tenant_id: tenantId, national_id: nationalIds },
        attributes: ['id', 'national_id', 'union_name'],
      });
      const byNationalId = new Map(existing.map((t) => [t.national_id, t]));

      const rows = parsed.map((row) => {
        const match = byNationalId.get(row.national_id);
        return {
          ...row,
          matched_teacher_id: match ? match.id : null,
          union_name: match ? match.union_name || null : null,
          include: true,
        };
      });

      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  async importMebbisCommit(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { school_id: schoolId, rows } = req.validatedBody || req.body;

      if (schoolId) {
        const school = await School.findByPk(schoolId);
        if (!school || (tenantId && school.tenant_id !== tenantId)) {
          return res.status(400).json({ success: false, message: 'Geçersiz okul' });
        }
      }

      const toImport = rows.filter((r) => r.include !== false);
      let created = 0;
      let updated = 0;
      if (tenantId) await ensureDefaultCategories(tenantId);

      await sequelize.transaction(async (transaction) => {
        const branchNames = [];
        for (const row of toImport) {
          const payload = buildTeacherPayloadFromMebbisRow(row, tenantId, schoolId);
          const category = await findCategoryByCode(tenantId, payload.personnel_type);
          if (category) payload.personnel_category_id = category.id;
          else payload.personnel_category_id = null;
          let teacher = null;
          if (row.matched_teacher_id) {
            teacher = await Teacher.findByPk(row.matched_teacher_id, { transaction });
            if (teacher && tenantId && teacher.tenant_id !== tenantId) teacher = null;
          }
          if (teacher) {
            await teacher.update(payload, { transaction });
            updated += 1;
            const branch = branchFromTeacher(teacher);
            if (branch) branchNames.push(branch);
          } else {
            const createdTeacher = await Teacher.create(payload, { transaction });
            created += 1;
            const branch = branchFromTeacher(createdTeacher);
            if (branch) branchNames.push(branch);
          }
        }
        if (tenantId) await ensureSubjectsForBranches(tenantId, branchNames, { transaction });
      });

      await audit.log(req, {
        action: 'create',
        entityType: 'teacher_mebbis_import',
        entityId: schoolId,
        summary: `MEBBİS'ten içe aktarma: ${created} yeni, ${updated} güncellenen personel`,
      });

      res.json({ success: true, data: { created, updated, total: toImport.length } });
    } catch (err) {
      next(err);
    }
  },

  async document(req, res, next) {
    try {
      const type = PERSONNEL_DOCUMENT_TITLES[req.query.type] ? req.query.type : 'gorevlendirme';
      const format = String(req.query.format || 'docx').toLowerCase() === 'pdf' ? 'pdf' : 'docx';
      const teacher = await Teacher.findByPk(req.params.id, {
        include: [{ model: School, required: false }],
      });
      if (!teacher) return res.status(404).json({ success: false, message: 'Bulunamadı' });
      if (req.user && req.user.tenant_id && teacher.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const schoolName = teacher.School?.name || 'Okul Müdürlüğü';
      const rows = [
        ['Adı Soyadı', `${teacher.first_name} ${teacher.last_name}`],
        ['Sicil No', teacher.personnel_no || '—'],
        ['Unvan', teacher.unvan || '—'],
        ['Branş', teacher.brans || '—'],
        ['Kariyer', teacher.kariyer || '—'],
        ['Görev Yeri', teacher.working_institution || schoolName],
      ];
      const bodyTextMap = {
        gorevlendirme: `Yukarıda kimlik bilgileri yazılı personel, kurumumuzda ilgili görevle görevlendirilmiştir. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
        baslama: `Yukarıda kimlik bilgileri yazılı personel, kurumumuzda göreve başlamıştır. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
        ayrilis: `Yukarıda kimlik bilgileri yazılı personelin kurumumuzdaki görevi sona ermiş ve ayrılış işlemleri tamamlanmıştır. Bu yazı ilgili işlemlerde kullanılmak üzere düzenlenmiştir.`,
      };
      const dateLabel = new Date().toLocaleDateString('tr-TR');

      const logExport = () =>
        audit.log(req, {
          action: 'export',
          entityType: 'teacher_document',
          entityId: teacher.id,
          summary: `${PERSONNEL_DOCUMENT_TITLES[type]} üretildi: ${teacher.first_name} ${teacher.last_name}`,
        });

      if (format === 'docx') {
        const buffer = await buildPersonnelDocumentDocx({
          schoolName,
          title: PERSONNEL_DOCUMENT_TITLES[type],
          rows,
          body: bodyTextMap[type],
          dateLabel,
        });
        await logExport();
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${type}-${teacher.personnel_no || teacher.id}.docx"`,
        );
        return res.send(buffer);
      }

      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      const fonts = registerUnicodeFonts(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-${teacher.personnel_no || teacher.id}.pdf"`);
      doc.pipe(res);

      doc.font(fonts.bold).fontSize(13).text(schoolName.toUpperCase(), { align: 'center' });
      doc.font(fonts.bold).fontSize(13).text(PERSONNEL_DOCUMENT_TITLES[type], { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(11);
      rows.forEach(([label, value]) => {
        doc.font(fonts.bold).text(`${label}: `, { continued: true });
        doc.font(fonts.regular).text(String(value));
        doc.moveDown(0.5);
      });

      doc.moveDown(2);
      doc.font(fonts.regular).text(bodyTextMap[type], { align: 'justify' });

      doc.moveDown(4);
      doc.text(`Düzenleme Tarihi: ${dateLabel}`, { align: 'right' });
      doc.moveDown(2);
      doc.text('Okul Müdürü', { align: 'right' });

      await logExport();
      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async upcomingPromotions(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const { getSalaryPeriodForDate, getSalaryPeriodRange } = require('../utils/salaryPeriod');
      const {
        advanceDegreeRank,
        applyCareerDegreeDrop,
        nextKariyerTitle,
        isAtCeiling,
        eightYearProgress,
      } = require('../utils/promotionEngine');

      const periodMonth = req.query.month ? Number(req.query.month) : null;
      const periodYear = req.query.year ? Number(req.query.year) : null;
      const period =
        periodMonth && periodYear
          ? getSalaryPeriodRange(periodMonth, periodYear)
          : getSalaryPeriodForDate(new Date());

      // days verilirse ek ufuk; yoksa yalnızca ilgili maaş dönemi (15→14)
      const days = req.query.days != null ? Number(req.query.days) : null;
      const today = new Date();
      const horizon =
        days != null && Number.isFinite(days)
          ? new Date(today.getTime() + days * 86400000)
          : period.endExclusive;

      // Terfi takibi: tüm öğretmen ve memurlar (norm kadro kategorisi ayrımı yapılmaz).
      const where = { tenant_id: tenantId, personnel_type: { [Op.in]: ['ogretmen', 'memur'] } };
      const teachers = await Teacher.findAll({
        where,
        order: [['degree_rank_date', 'ASC']],
      });

      const allRows = teachers.map((t) => {
        const atCeiling = isAtCeiling(t.degree, t.rank);
        const suggested = advanceDegreeRank(t.degree, t.rank);

        let nextDate = null;
        let daysRemaining = null;
        let inCurrentPeriod = false;
        // Kademe tarihi yoksa göreve ilk başlama tarihi terfi tarihidir; yıl dönümü esas alınır.
        const promotionBase = toDateOnly(t.degree_rank_date) || toDateOnly(t.first_duty_date);
        if (promotionBase) {
          const todayIso = toDateOnly(today);
          const nextIso = nextAnniversary(promotionBase, today);
          const missed = lastAnniversary(promotionBase, todayIso);
          const overdueDays = missed && missed > promotionBase ? daysBetweenIso(missed, todayIso) : 0;
          if (overdueDays > 0 && overdueDays <= 90) {
            daysRemaining = -overdueDays;
            nextDate = new Date(`${missed}T00:00:00`);
          } else if (nextIso) {
            nextDate = new Date(`${nextIso}T00:00:00`);
            daysRemaining = daysBetweenIso(todayIso, nextIso);
          }
          inCurrentPeriod = Boolean(anniversaryInPeriod(promotionBase, period));
        }

        const eightYear = eightYearProgress(t.eight_year_base_date || t.first_duty_date, today);

        const kariyerEligible =
          !atCeiling && (t.kariyer === 'Öğretmen' || t.kariyer === 'Uzman Öğretmen');
        const kariyerSuggestedDegree = kariyerEligible ? applyCareerDegreeDrop(t.degree).degree : null;
        const kariyerSuggestedTitle = kariyerEligible ? nextKariyerTitle(t.kariyer) : null;

        return {
          teacher_id: t.id,
          teacher_name: `${t.first_name} ${t.last_name}`,
          personnel_no: t.personnel_no,
          personnel_type: t.personnel_type,
          degree: t.degree,
          rank: t.rank,
          at_ceiling: atCeiling,
          suggested_degree: suggested.degree,
          suggested_rank: suggested.rank,
          degree_rank_date: promotionBase,
          next_promotion_date: nextDate ? toDateOnly(nextDate) : null,
          days_remaining: daysRemaining,
          in_current_period: inCurrentPeriod,
          eight_year_base_date: t.eight_year_base_date || t.first_duty_date || null,
          eight_year_next_checkpoint: eightYear.nextCheckpoint
            ? eightYear.nextCheckpoint.toISOString().slice(0, 10)
            : null,
          eight_year_due: eightYear.isCheckpointDue,
          kariyer: t.kariyer || null,
          kariyer_eligible: kariyerEligible,
          kariyer_suggested_degree: kariyerSuggestedDegree,
          kariyer_suggested_title: kariyerSuggestedTitle,
        };
      });

      const showAll = String(req.query.all || '').toLowerCase() === 'true';

      const isDue = (row) => row.kariyer_eligible || row.eight_year_due || row.in_current_period;

      const data = (
        showAll
          ? allRows
          : allRows
              .filter((row) => row.degree_rank_date || row.eight_year_due || row.kariyer_eligible)
              .filter((row) => {
                if (row.kariyer_eligible || row.eight_year_due) return true;
                if (!row.next_promotion_date) return false;
                const next = new Date(row.next_promotion_date);
                if (days != null && Number.isFinite(days)) {
                  return next <= horizon;
                }
                return row.in_current_period || next <= period.endExclusive;
              })
      ).sort((a, b) => {
        if (Boolean(a.at_ceiling) !== Boolean(b.at_ceiling)) return a.at_ceiling ? 1 : -1;
        if (isDue(a) !== isDue(b)) return isDue(a) ? -1 : 1;
        return (a.days_remaining ?? Infinity) - (b.days_remaining ?? Infinity);
      });

      res.json({
        success: true,
        data,
        meta: {
          period: {
            month: period.month,
            year: period.year,
            start: period.start.toISOString().slice(0, 10),
            end: new Date(period.endExclusive.getTime() - 86400000).toISOString().slice(0, 10),
            start_label: period.startLabel,
            end_label: period.endLabel,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async schoolPrincipal(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const schoolId = req.query.school_id ? Number(req.query.school_id) : null;
      if (schoolId) {
        const school = await School.findByPk(schoolId);
        if (!school || (tenantId && school.tenant_id !== tenantId)) {
          return res.status(404).json({ success: false, message: 'Okul bulunamadı' });
        }
      }
      const name = await resolvePrincipalName(tenantId, schoolId, { fallback: false });
      res.json({ success: true, data: { full_name: name || null } });
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
      applyPersonnelScope(where, req.query);
      const teachers = await Teacher.findAll({
        where,
        include: [{ model: PersonnelCategory, required: false }],
        order: [
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
        ],
        limit: 500,
      });
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
      const body = { ...(req.validatedBody || req.body) };
      if (req.user && req.user.tenant_id) body.tenant_id = req.user.tenant_id;
      await applyCategoryToPayload(body, body.tenant_id);
      if (!body.personnel_category_id) {
        body.personnel_type = body.personnel_type || 'ogretmen';
        body.personnel_category_id = null;
      }
      const isTeacher = body.personnel_type === 'ogretmen' && body.personnel_category_id == null;
      const payload = normalizeTeacherContact(applyTitleFields(body, { defaultKariyer: isTeacher }));
      const teacher = await sequelize.transaction(async (transaction) => {
        const created = await Teacher.create(payload, { transaction });
        await ensureSubjectFromTeacher(created, { transaction });
        return created;
      });
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
      const payload = normalizeTeacherContact(applyTitleFields({ ...(req.validatedBody || req.body) }));
      if (req.user && req.user.tenant_id) payload.tenant_id = req.user.tenant_id;
      await applyCategoryToPayload(payload, teacher.tenant_id);
      if (payload.personnel_category_id === null) {
        payload.personnel_type = payload.personnel_type || 'ogretmen';
      }
      await sequelize.transaction(async (transaction) => {
        await teacher.update(payload, { transaction });
        await ensureSubjectFromTeacher(teacher, { transaction });
      });
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
      applyPersonnelScope(where, filters || {});

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
