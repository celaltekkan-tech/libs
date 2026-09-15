'use strict';

const { Op } = require('sequelize');
const { Teacher, PromotionHistory, School, sequelize } = require('../models');
const audit = require('../services/auditService');
const { fillPromotionForm, fillSalaryChangeForm } = require('../services/promotionFormService');
const { getSalaryPeriodRange } = require('../utils/salaryPeriod');

function assertTenantAccess(req, row) {
  return !(req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id);
}

module.exports = {
  async applyPromotion(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Öğretmen bulunamadı' });
      if (!assertTenantAccess(req, teacher)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const { new_degree, new_rank, new_degree_rank_date, note } = req.validatedBody;

      const history = await sequelize.transaction(async (transaction) => {
        const created = await PromotionHistory.create(
          {
            tenant_id: teacher.tenant_id,
            teacher_id: teacher.id,
            previous_degree: teacher.degree,
            previous_rank: teacher.rank,
            previous_degree_rank_date: teacher.degree_rank_date,
            new_degree,
            new_rank,
            new_degree_rank_date,
            note: note || null,
            created_by: req.user.user_id || null,
          },
          { transaction },
        );

        await teacher.update(
          { degree: new_degree, rank: new_rank, degree_rank_date: new_degree_rank_date },
          { transaction },
        );

        return created;
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'teacher_promotion',
        entityId: teacher.id,
        summary: `Terfi/kademe ilerlemesi uygulandı: ${teacher.first_name} ${teacher.last_name} (${history.previous_degree || '—'}/${history.previous_rank || '—'} → ${new_degree}/${new_rank})`,
      });

      res.status(201).json({ success: true, data: { teacher, history } });
    } catch (err) {
      next(err);
    }
  },

  async listHistory(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Öğretmen bulunamadı' });
      if (!assertTenantAccess(req, teacher)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const history = await PromotionHistory.findAll({
        where: { teacher_id: teacher.id },
        order: [['new_degree_rank_date', 'DESC']],
      });

      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  },

  async exportPromotionForm(req, res, next) {
    try {
      const history = await PromotionHistory.findByPk(req.params.historyId, {
        include: [{ model: Teacher }],
      });
      if (!history || !history.Teacher) {
        return res.status(404).json({ success: false, message: 'Terfi kaydı bulunamadı' });
      }
      if (!assertTenantAccess(req, history)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const buffer = await fillPromotionForm(history, history.Teacher);

      await audit.log(req, {
        action: 'export',
        entityType: 'teacher_promotion_form',
        entityId: history.teacher_id,
        summary: `Kademe terfi formu indirildi: ${history.Teacher.first_name} ${history.Teacher.last_name}`,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="terfi-formu-${history.Teacher.personnel_no || history.teacher_id}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  async exportSalaryForm(req, res, next) {
    try {
      const tenantId = req.user && req.user.tenant_id;
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!month || month < 1 || month > 12 || !year) {
        return res.status(400).json({ success: false, message: 'Geçerli bir ay ve yıl belirtmelisiniz' });
      }

      // İlgili ay formu: önceki ayın 15'i – seçilen ayın 14'ü (ör. Ekim → 15 Eyl–14 Eki)
      const period = getSalaryPeriodRange(month, year);

      const histories = await PromotionHistory.findAll({
        where: {
          tenant_id: tenantId,
          new_degree_rank_date: { [Op.gte]: period.start, [Op.lt]: period.endExclusive },
        },
        include: [{ model: Teacher, include: [{ model: School, required: false }] }],
        order: [['new_degree_rank_date', 'ASC']],
      });

      const entries = histories.filter((h) => h.Teacher).map((h) => ({ history: h, teacher: h.Teacher }));
      const institutionName =
        entries[0]?.teacher.School?.name || entries[0]?.teacher.working_institution || null;

      const { buffer, truncated } = await fillSalaryChangeForm(entries, {
        month,
        year,
        institutionName,
      });

      await audit.log(req, {
        action: 'export',
        entityType: 'salary_change_form',
        entityId: null,
        summary: `Maaş değişikliği formu (terfi bölümü) indirildi: ${period.startLabel}–${period.endLabel}, ${entries.length} kayıt`,
      });

      if (truncated) res.setHeader('X-Promotion-Rows-Truncated', 'true');
      res.setHeader('X-Salary-Period-Start', period.startLabel);
      res.setHeader('X-Salary-Period-End', period.endLabel);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="maas-degisiklik-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
