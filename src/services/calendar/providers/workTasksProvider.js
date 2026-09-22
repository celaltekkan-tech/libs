'use strict';

/**
 * İş takibi takvim kaynağı.
 * Tekrarlayan görevler görünür ay aralığında oluşumlara genişletilir.
 */

const { Op } = require('sequelize');
const { WorkTask, User } = require('../../../models');
const {
  expandOccurrencesInRange,
  istanbulParts,
  isOccurrenceComplete,
} = require('../../workTaskService');

const SOURCE_ID = 'work_tasks';

function dueStateForOccurrence(task, occurrenceAt) {
  const due = occurrenceAt instanceof Date ? occurrenceAt : new Date(occurrenceAt);
  const now = new Date();
  const nextDue = new Date(task.next_due_at);

  if (task.status === 'completed' || task.status === 'cancelled') return task.status;

  // Yalnızca saklanan next_due_at oluşumu için tamamlandı / gecikme durumu
  const sameNextDue =
    istanbulParts(due).year === istanbulParts(nextDue).year &&
    istanbulParts(due).month === istanbulParts(nextDue).month &&
    istanbulParts(due).day === istanbulParts(nextDue).day;

  if (sameNextDue && isOccurrenceComplete(task)) return 'done_period';
  if (sameNextDue && now > nextDue) return 'overdue';
  if (sameNextDue && now >= new Date(nextDue.getTime() - (task.remind_before_minutes || 0) * 60000)) {
    return 'due_soon';
  }
  if (!sameNextDue && due.getTime() < now.getTime() && due.getTime() < nextDue.getTime()) {
    // Geçmiş ay oluşumu (tamamlanıp kaymış olabilir)
    return 'done_period';
  }
  return 'upcoming';
}

function colorKeyForDueState(state, status) {
  if (status === 'paused') return 'work_tasks_paused';
  if (state === 'overdue') return 'work_tasks_overdue';
  if (state === 'due_soon') return 'work_tasks_due_soon';
  return 'work_tasks';
}

function dayKeyIstanbul(date) {
  const p = istanbulParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const workTasksProvider = {
  id: SOURCE_ID,
  label: 'İş Takibi',
  permission: 'work_tasks.read',

  /**
   * @param {{ tenantId: number, from: Date, to: Date }} ctx
   */
  async listEvents({ tenantId, from, to }) {
    const rows = await WorkTask.findAll({
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ['active', 'paused'] },
      },
      include: [
        {
          model: User,
          as: 'Assignee',
          attributes: ['id', 'full_name'],
          required: false,
        },
      ],
      order: [['next_due_at', 'ASC']],
      limit: 1000,
    });

    const events = [];
    for (const row of rows) {
      const data = row.toJSON();
      const occurrences = expandOccurrencesInRange(data, from, to);
      for (const occ of occurrences) {
        const state = dueStateForOccurrence(data, occ);
        const dayKey = dayKeyIstanbul(occ);
        events.push({
          id: `${SOURCE_ID}:${data.id}:${dayKey}`,
          source: SOURCE_ID,
          title: data.title,
          start_at: occ.toISOString(),
          end_at: null,
          all_day: false,
          color_key: colorKeyForDueState(state, data.status),
          href: '/work-tasks',
          meta: {
            entity_id: data.id,
            status: data.status,
            due_state: state,
            frequency: data.frequency,
            is_mandatory: Boolean(data.is_mandatory),
            assignee_name: data.Assignee?.full_name || null,
            assignee_user_id: data.assignee_user_id,
            occurrence_date: dayKey,
          },
        });
      }
    }

    events.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
    return events;
  },
};

module.exports = workTasksProvider;
