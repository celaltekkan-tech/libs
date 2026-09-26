'use strict';

const { Op } = require('sequelize');
const { Teacher, PromotionHistory, School, sequelize } = require('../models');
const audit = require('../services/auditService');
const { fillPromotionForm, fillSalaryChangeForm } = require('../services/promotionFormService');
const { resolvePrincipalName } = require('../services/schoolPrincipalService');
const { getSalaryPeriodRange } = require('../utils/salaryPeriod');
const { advanceDegreeRank, addYears, eightYearProgress, nextKariyerTitle } = require('../utils/promotionEngine');

function assertTenantAccess(req, row) {
  return !(req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id);
}

module.exports = {
  async applyPromotion(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Personel bulunamadı' });
      if (!assertTenantAccess(req, teacher)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const { new_degree, new_rank, new_degree_rank_date, note, type, override_reason, is_permanent } =
        req.validatedBody;

      // Yıllık düzenli ilerleme ve sürekli terfi-tarihi değişikliklerinde takvim (anchor)
      // yeni tarihe kayar. Tek seferlik terfi-tarihi değişikliklerinde, 8 yıl bonusunda ve
      // kariyer (Uzman/Başöğretmen) terfisinde düzenli yıllık takvim bozulmaz.
      const anchor = teacher.degree_rank_anchor_date || teacher.degree_rank_date;
      let nextDegreeRankDate = teacher.degree_rank_date;
      let nextAnchor = anchor;

      if (type === 'yillik') {
        nextDegreeRankDate = new_degree_rank_date;
        nextAnchor = new_degree_rank_date;
      } else if (type === 'manuel') {
        if (is_permanent) {
          nextDegreeRankDate = new_degree_rank_date;
          nextAnchor = new_degree_rank_date;
        } else {
          nextDegreeRankDate = anchor ? addYears(anchor, 1) : new_degree_rank_date;
          nextAnchor = anchor;
        }
      }

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
            type,
            override_reason: override_reason || null,
            is_permanent,
            created_by: req.user.user_id || null,
          },
          { transaction },
        );

        await teacher.update(
          {
            degree: new_degree,
            rank: new_rank,
            degree_rank_date: nextDegreeRankDate,
            degree_rank_anchor_date: nextAnchor,
            ...(type === 'kariyer' ? { kariyer: nextKariyerTitle(teacher.kariyer) || teacher.kariyer } : {}),
          },
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

  /** Sistem dışında yapılmış terfiyi derece/kademe değiştirmeden takvime işler. */
  async acknowledgeExternalPromotion(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Personel bulunamadı' });
      if (!assertTenantAccess(req, teacher)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const appliedDate = req.validatedBody.degree_rank_date;
      const history = await sequelize.transaction(async (transaction) => {
        const created = await PromotionHistory.create(
          {
            tenant_id: teacher.tenant_id,
            teacher_id: teacher.id,
            previous_degree: teacher.degree,
            previous_rank: teacher.rank,
            previous_degree_rank_date: teacher.degree_rank_date,
            new_degree: teacher.degree,
            new_rank: teacher.rank,
            new_degree_rank_date: appliedDate,
            note: 'Sistem dışında uygulandı',
            type: 'harici',
            override_reason: 'Terfi sistem dışında yapılmış olarak işaretlendi. Derece ve kademe değiştirilmedi.',
            is_permanent: true,
            created_by: req.user.user_id || null,
          },
          { transaction },
        );
        await teacher.update(
          {
            degree_rank_date: appliedDate,
            degree_rank_anchor_date: appliedDate,
          },
          { transaction },
        );
        return created;
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'teacher_promotion',
        entityId: teacher.id,
        summary: `Terfi sistem dışında uygulandı olarak işaretlendi: ${teacher.first_name} ${teacher.last_name}`,
      });

      res.status(201).json({ success: true, data: { teacher, history } });
    } catch (err) {
      next(err);
    }
  },

  /** Öğretmen/memurun 8 yıllık ceza-siz dönem kontrolü sonucunu işler. */
  async reportEightYearCheck(req, res, next) {
    try {
      const teacher = await Teacher.findByPk(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Personel bulunamadı' });
      if (!assertTenantAccess(req, teacher)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const { has_penalty, penalty_date, note } = req.validatedBody;

      if (has_penalty) {
        await sequelize.transaction(async (transaction) => {
          await PromotionHistory.create(
            {
              tenant_id: teacher.tenant_id,
              teacher_id: teacher.id,
              previous_degree: teacher.degree,
              previous_rank: teacher.rank,
              previous_degree_rank_date: teacher.degree_rank_date,
              new_degree: teacher.degree,
              new_rank: teacher.rank,
              new_degree_rank_date: teacher.degree_rank_date,
              note: note || null,
              type: 'sekiz_yil',
              override_reason: `Ceza bildirildi (${penalty_date}); 8 yıllık sayaç bu tarihten yeniden başlar.`,
              is_permanent: true,
              created_by: req.user.user_id || null,
            },
            { transaction },
          );
          await teacher.update({ eight_year_base_date: penalty_date }, { transaction });
        });

        await audit.log(req, {
          action: 'update',
          entityType: 'teacher_promotion',
          entityId: teacher.id,
          summary: `8 yıllık kademe kontrolü: ceza bildirildi (${teacher.first_name} ${teacher.last_name})`,
        });

        return res.json({ success: true, data: { teacher, bonusApplied: false } });
      }

      const progress = eightYearProgress(teacher.eight_year_base_date || teacher.first_duty_date, new Date());
      const checkpointDate = progress.currentCheckpoint || new Date();
      const advanced = advanceDegreeRank(teacher.degree, teacher.rank);

      const history = await sequelize.transaction(async (transaction) => {
        const created = await PromotionHistory.create(
          {
            tenant_id: teacher.tenant_id,
            teacher_id: teacher.id,
            previous_degree: teacher.degree,
            previous_rank: teacher.rank,
            previous_degree_rank_date: teacher.degree_rank_date,
            new_degree: advanced.degree,
            new_rank: advanced.rank,
            new_degree_rank_date: teacher.degree_rank_date,
            note: note || null,
            type: 'sekiz_yil',
            override_reason: '8 yıl boyunca ceza almadı, ek kademe uygulandı.',
            is_permanent: true,
            created_by: req.user.user_id || null,
          },
          { transaction },
        );

        await teacher.update(
          {
            degree: advanced.degree,
            rank: advanced.rank,
            eight_year_base_date: checkpointDate,
          },
          { transaction },
        );

        return created;
      });

      await audit.log(req, {
        action: 'update',
        entityType: 'teacher_promotion',
        entityId: teacher.id,
        summary: `8 yıllık ceza-siz kademe bonusu uygulandı: ${teacher.first_name} ${teacher.last_name} (${history.previous_degree || '—'}/${history.previous_rank || '—'} → ${advanced.degree}/${advanced.rank})`,
      });

      res.json({ success: true, data: { teacher, history, bonusApplied: true } });
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

      const principalName = await resolvePrincipalName(history.tenant_id, history.Teacher.school_id, {
        fallback: true,
      });
      const buffer = await fillPromotionForm(history, history.Teacher, { principalName });

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
      const principalName = await resolvePrincipalName(
        tenantId,
        entries[0]?.teacher.school_id || entries[0]?.teacher.School?.id || null,
        { fallback: true },
      );

      const { buffer, truncated } = await fillSalaryChangeForm(entries, {
        month,
        year,
        institutionName,
        principalName,
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
