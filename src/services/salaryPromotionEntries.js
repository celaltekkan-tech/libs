'use strict';

const { Op } = require('sequelize');
const { Teacher, PromotionHistory, School } = require('../models');
const { advanceDegreeRank, isAtCeiling } = require('../utils/promotionEngine');
const { calendarDate } = require('../utils/calendarDate');

function dateOnly(value) {
  return calendarDate(value);
}

function anniversaryInRange(baseIso, range) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso || '');
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const years = new Set([range.start.getUTCFullYear(), new Date(range.endExclusive.getTime() - 86400000).getUTCFullYear()]);
  for (const year of years) {
    const anniversary = new Date(Date.UTC(year, month - 1, day));
    if (anniversary >= range.start && anniversary < range.endExclusive) {
      return anniversary.toISOString().slice(0, 10);
    }
  }
  return null;
}

/** Bugünden önceki son yıl dönümü. Taban yıldan sonraysa dolu döner. */
function missedAnniversary(baseIso, todayIso) {
  const base = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso || '');
  const today = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso || '');
  if (!base || !today) return null;
  const month = Number(base[2]);
  const day = Number(base[3]);
  let year = Number(today[1]);
  let anniversary = new Date(Date.UTC(year, month - 1, day));
  const todayDate = new Date(Date.UTC(Number(today[1]), Number(today[2]) - 1, Number(today[3])));
  if (anniversary > todayDate) anniversary = new Date(Date.UTC(year - 1, month - 1, day));
  const baseDate = new Date(Date.UTC(Number(base[1]), month - 1, day));
  if (anniversary.getTime() <= baseDate.getTime()) return null;
  if (anniversary > todayDate) return null;
  return anniversary.toISOString().slice(0, 10);
}

function entryFromHistory(history) {
  return { history, teacher: history.Teacher };
}

function syntheticEntry(teacher, promotionDate) {
  const next = advanceDegreeRank(teacher.degree, teacher.rank);
  return {
    history: {
      previous_degree: teacher.degree,
      previous_rank: teacher.rank,
      new_degree: next.degree,
      new_rank: next.rank,
      new_degree_rank_date: promotionDate,
      note: '',
      type: 'beklenen',
    },
    teacher,
  };
}

/**
 * D bölümü: dönemdeki terfi kayıtları, bu ay verilen uzmanlık terfisi
 * ve henüz işlenmemiş (7 günü aşmış dahil) yıl dönümleri.
 */
async function collectSalaryPromotionEntries(tenantId, range) {
  const histories = await PromotionHistory.findAll({
    where: {
      tenant_id: tenantId,
      [Op.or]: [
        { new_degree_rank_date: { [Op.gte]: range.start, [Op.lt]: range.endExclusive } },
        { type: 'kariyer', created_at: { [Op.gte]: range.start, [Op.lt]: range.endExclusive } },
      ],
    },
    include: [{ model: Teacher, include: [{ model: School, required: false }] }],
    order: [['new_degree_rank_date', 'ASC']],
  });

  const entries = histories.filter((row) => row.Teacher).map(entryFromHistory);
  const covered = new Set(entries.map((row) => row.teacher.id));

  const teachers = await Teacher.findAll({
    where: { tenant_id: tenantId, personnel_type: { [Op.in]: ['ogretmen', 'memur'] } },
    include: [{ model: School, required: false }],
  });
  const today = calendarDate(new Date());
  const pending = [];
  for (const teacher of teachers) {
    if (covered.has(teacher.id) || isAtCeiling(teacher.degree, teacher.rank)) continue;
    const base = dateOnly(teacher.degree_rank_date) || dateOnly(teacher.first_duty_date);
    if (!base) continue;
    const inPeriod = anniversaryInRange(base, range);
    const missed = missedAnniversary(base, today);
    const promotionDate = inPeriod || missed;
    if (!promotionDate) continue;
    pending.push(syntheticEntry(teacher, promotionDate));
  }
  pending.sort((a, b) => String(a.history.new_degree_rank_date).localeCompare(String(b.history.new_degree_rank_date)));
  return [...entries, ...pending];
}

module.exports = { collectSalaryPromotionEntries };
