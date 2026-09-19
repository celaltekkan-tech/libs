'use strict';

const { Op } = require('sequelize');
const { SalaryFormDraft, PromotionHistory, Teacher, School, sequelize } = require('../models');
const audit = require('../services/auditService');
const { fillSalaryChangeForm, buildSalaryFormModel } = require('../services/promotionFormService');
const { buildSalaryChangePdf } = require('../services/salaryFormPdfService');
const { getSalaryPeriodRange } = require('../utils/salaryPeriod');

const EMPTY_PAYLOAD = {
  institution_name: '',
  bank_branch: '',
  accounting_code: '',
  principal: '',
  form_date: '',
  previous_month_count: null,
  started_count: null,
  left_count: null,
  payable_count: null,
  departures: [],
  starters: [],
  other_changes: [],
  deductions: [],
  report_days: [],
  union_changes: [],
};

function parsePeriod(query) {
  const month = Number(query.month);
  const year = Number(query.year);
  if (!month || month < 1 || month > 12 || !year) {
    return null;
  }
  return { month, year };
}

function parseFormat(query) {
  const format = String(query.format || 'xlsx').toLowerCase();
  return format === 'pdf' ? 'pdf' : 'xlsx';
}

async function loadExportContext(req, period) {
  const tenantId = req.user.tenant_id;
  const range = getSalaryPeriodRange(period.month, period.year);

  const draft = await SalaryFormDraft.findOne({
    where: { tenant_id: tenantId, month: period.month, year: period.year },
  });

  const histories = await PromotionHistory.findAll({
    where: {
      tenant_id: tenantId,
      new_degree_rank_date: { [Op.gte]: range.start, [Op.lt]: range.endExclusive },
    },
    include: [{ model: Teacher, include: [{ model: School, required: false }] }],
    order: [['new_degree_rank_date', 'ASC']],
  });

  const entries = histories.filter((h) => h.Teacher).map((h) => ({ history: h, teacher: h.Teacher }));
  const institutionName =
    draft?.payload?.institution_name ||
    entries[0]?.teacher.School?.name ||
    entries[0]?.teacher.working_institution ||
    null;

  const options = {
    month: period.month,
    year: period.year,
    institutionName,
    draft: draft?.payload || EMPTY_PAYLOAD,
  };

  return { draft, entries, options, range };
}

module.exports = {
  async getDraft(req, res, next) {
    try {
      const period = parsePeriod(req.query);
      if (!period) {
        return res.status(400).json({ success: false, message: 'Geçerli ay ve yıl gerekli' });
      }

      const tenantId = req.user.tenant_id;
      const draft = await SalaryFormDraft.findOne({
        where: { tenant_id: tenantId, month: period.month, year: period.year },
      });

      const range = getSalaryPeriodRange(period.month, period.year);
      const promotionCount = await PromotionHistory.count({
        where: {
          tenant_id: tenantId,
          new_degree_rank_date: { [Op.gte]: range.start, [Op.lt]: range.endExclusive },
        },
      });

      res.json({
        success: true,
        data: {
          month: period.month,
          year: period.year,
          period_label: `${range.startLabel} – ${range.endLabel}`,
          payload: { ...EMPTY_PAYLOAD, ...(draft?.payload || {}) },
          promotion_count: promotionCount,
          updated_at: draft?.updated_at || null,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async upsertDraft(req, res, next) {
    try {
      const { month, year, payload } = req.validatedBody || req.body;
      const tenantId = req.user.tenant_id;
      const userId = req.user.user_id || null;

      const [draft, created] = await SalaryFormDraft.findOrCreate({
        where: { tenant_id: tenantId, month, year },
        defaults: {
          payload: { ...EMPTY_PAYLOAD, ...payload },
          created_by: userId,
          updated_by: userId,
        },
      });

      if (!created) {
        await draft.update({
          payload: { ...EMPTY_PAYLOAD, ...payload },
          updated_by: userId,
        });
      }

      await audit.log(req, {
        action: 'update',
        entityType: 'salary_form_draft',
        entityId: draft.id,
        summary: `Maaş değişikliği formu taslağı kaydedildi: ${month}/${year}`,
      });

      res.json({
        success: true,
        message: 'Taslak kaydedildi',
        data: {
          month,
          year,
          payload: draft.payload,
          updated_at: draft.updated_at,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Personel ayrılış/yeni başlama akışları gibi otomasyonların kullandığı, tek satır
   * ekleyen uç. upsertDraft'ın aksine tüm payload'ı istemciden almaz — satır DB'de
   * transaction + row lock ile eklenir; böylece o an başka bir sekmede açık duran ve
   * eski bir kopyayla "Kaydet"e basan Maaş Değişikliği modalı bu satırı ezemez.
   */
  async appendDraftRow(req, res, next) {
    try {
      const { month, year, section, row } = req.validatedBody || req.body;
      const tenantId = req.user.tenant_id;
      const userId = req.user.user_id || null;

      const applyAppend = () =>
        sequelize.transaction(async (transaction) => {
          const existing = await SalaryFormDraft.findOne({
            where: { tenant_id: tenantId, month, year },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!existing) {
            return SalaryFormDraft.create(
              {
                tenant_id: tenantId,
                month,
                year,
                payload: { ...EMPTY_PAYLOAD, [section]: [row] },
                created_by: userId,
                updated_by: userId,
              },
              { transaction }
            );
          }

          const payload = { ...EMPTY_PAYLOAD, ...existing.payload };
          const list = Array.isArray(payload[section]) ? payload[section].slice() : [];
          list.push(row);
          payload[section] = list;
          await existing.update({ payload, updated_by: userId }, { transaction });
          return existing;
        });

      let draft;
      try {
        draft = await applyAppend();
      } catch (err) {
        // İlk satır için iki istek aynı anda yeni taslak oluşturmaya çalışırsa unique
        // constraint çakışabilir; bu durumda tekrar dener (artık satır mevcut olacağı
        // için ikinci deneme update yoluna girer).
        if (err.name === 'SequelizeUniqueConstraintError') {
          draft = await applyAppend();
        } else {
          throw err;
        }
      }

      await audit.log(req, {
        action: 'update',
        entityType: 'salary_form_draft',
        entityId: draft.id,
        summary: `Maaş değişikliği formuna otomatik satır eklendi (${section}): ${month}/${year}`,
      });

      res.json({
        success: true,
        data: { month, year, payload: draft.payload, updated_at: draft.updated_at },
      });
    } catch (err) {
      next(err);
    }
  },

  async export(req, res, next) {
    try {
      const period = parsePeriod(req.query);
      if (!period) {
        return res.status(400).json({ success: false, message: 'Geçerli ay ve yıl gerekli' });
      }

      const format = parseFormat(req.query);
      const inline =
        String(req.query.inline || '') === '1' || String(req.query.inline || '').toLowerCase() === 'true';
      const { draft, entries, options, range } = await loadExportContext(req, period);
      const baseName = `maas-degisiklik-${period.year}-${String(period.month).padStart(2, '0')}`;

      let buffer;
      let truncated = false;
      let contentType;
      let filename;

      if (format === 'pdf') {
        const model = buildSalaryFormModel(entries, options);
        truncated = model.truncated;
        buffer = await buildSalaryChangePdf(model);
        contentType = 'application/pdf';
        filename = `${baseName}.pdf`;
      } else {
        const result = await fillSalaryChangeForm(entries, options);
        buffer = result.buffer;
        truncated = result.truncated;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${baseName}.xlsx`;
      }

      await audit.log(req, {
        action: 'export',
        entityType: 'salary_change_form',
        entityId: draft?.id || null,
        summary: `Maaş değişikliği formu (${format.toUpperCase()}) indirildi: ${range.startLabel}–${range.endLabel}`,
      });

      if (truncated) res.setHeader('X-Promotion-Rows-Truncated', 'true');
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `${inline && format === 'pdf' ? 'inline' : 'attachment'}; filename="${filename}"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
