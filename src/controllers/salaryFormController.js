'use strict';

const { Op } = require('sequelize');
const { SalaryFormDraft, PromotionHistory, Teacher, School } = require('../models');
const audit = require('../services/auditService');
const { fillSalaryChangeForm } = require('../services/promotionFormService');
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

  async export(req, res, next) {
    try {
      const period = parsePeriod(req.query);
      if (!period) {
        return res.status(400).json({ success: false, message: 'Geçerli ay ve yıl gerekli' });
      }

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

      const { buffer, truncated } = await fillSalaryChangeForm(entries, {
        month: period.month,
        year: period.year,
        institutionName,
        draft: draft?.payload || EMPTY_PAYLOAD,
      });

      await audit.log(req, {
        action: 'export',
        entityType: 'salary_change_form',
        entityId: draft?.id || null,
        summary: `Maaş değişikliği formu indirildi: ${range.startLabel}–${range.endLabel}`,
      });

      if (truncated) res.setHeader('X-Promotion-Rows-Truncated', 'true');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="maas-degisiklik-${period.year}-${String(period.month).padStart(2, '0')}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
