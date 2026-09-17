'use strict';

const { WorkTask, WorkTaskNotificationLog, User, Notification } = require('../models');
const { isOccurrenceComplete } = require('./workTaskService');
const smsEngine = require('./smsEngine');
const emailEngine = require('./emailEngine');
const messageLogService = require('./messageLogService');

function startOfIstanbulDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d);
}

function channels(task) {
  const list = Array.isArray(task.notify_channels) ? task.notify_channels : [];
  return list.filter((c) => ['in_app', 'sms', 'email'].includes(c));
}

async function logNotification({ task, userId, channel, kind, occurrenceDueAt, status, error }) {
  try {
    await WorkTaskNotificationLog.create({
      work_task_id: task.id,
      user_id: userId,
      channel,
      kind,
      occurrence_due_at: occurrenceDueAt,
      status,
      error: error || null,
    });
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
  }
}

async function sendInApp(task, assignee, title, body) {
  await Notification.create({
    recipient_user_id: assignee.id,
    tenant_id: task.tenant_id,
    sender_user_id: null,
    title,
    body,
  });
  return { status: 'basarili', error: null };
}

async function dispatchChannel(task, assignee, channel, kind, title, body) {
  const occurrenceDueAt = task.next_due_at;
  if (channel === 'in_app') {
    const r = await sendInApp(task, assignee, title, body);
    await logNotification({
      task,
      userId: assignee.id,
      channel,
      kind,
      occurrenceDueAt,
      status: r.status,
      error: r.error,
    });
    return;
  }
  if (channel === 'sms') {
    const result = await smsEngine.sendSms({ phoneNumber: assignee.phone, message: `${title}\n${body}` });
    await logNotification({
      task,
      userId: assignee.id,
      channel,
      kind,
      occurrenceDueAt,
      status: result.status,
      error: result.error,
    });
    await messageLogService.record({
      tenantId: task.tenant_id,
      channel: 'sms',
      sourceModule: `work_task_${kind}`,
      sourceId: task.id,
      recipientLabel: assignee.full_name,
      recipientContact: assignee.phone,
      subject: title,
      body,
      status: result.status,
      error: result.error,
      sentAt: result.status === smsEngine.SMS_STATUS.SUCCESS ? new Date() : null,
    });
    return;
  }
  if (channel === 'email') {
    try {
      const result = await emailEngine.sendEmail({
        to: assignee.email,
        subject: title,
        text: body,
      });
      await logNotification({
        task,
        userId: assignee.id,
        channel,
        kind,
        occurrenceDueAt,
        status: result.status,
        error: result.error,
      });
      await messageLogService.record({
        tenantId: task.tenant_id,
        channel: 'email',
        sourceModule: `work_task_${kind}`,
        sourceId: task.id,
        recipientLabel: assignee.full_name,
        recipientContact: assignee.email,
        subject: title,
        body,
        status: result.status,
        error: result.error,
        sentAt: result.status === emailEngine.EMAIL_STATUS.SUCCESS ? new Date() : null,
      });
    } catch (err) {
      await logNotification({
        task,
        userId: assignee.id,
        channel,
        kind,
        occurrenceDueAt,
        status: 'basarisiz',
        error: err.message,
      });
      await messageLogService.record({
        tenantId: task.tenant_id,
        channel: 'email',
        sourceModule: `work_task_${kind}`,
        sourceId: task.id,
        recipientLabel: assignee.full_name,
        recipientContact: assignee.email,
        subject: title,
        body,
        status: 'basarisiz',
        error: err.message,
        sentAt: null,
      });
    }
  }
}

async function alreadySent(taskId, occurrenceDueAt, channel, kind) {
  const row = await WorkTaskNotificationLog.findOne({
    where: {
      work_task_id: taskId,
      occurrence_due_at: occurrenceDueAt,
      channel,
      kind,
    },
  });
  return Boolean(row);
}

async function overdueSentToday(taskId, userId, channel) {
  const today = startOfIstanbulDay(new Date());
  const rows = await WorkTaskNotificationLog.findAll({
    where: {
      work_task_id: taskId,
      user_id: userId,
      channel,
      kind: 'overdue',
    },
    order: [['created_at', 'DESC']],
    limit: 20,
  });
  return rows.some((r) => startOfIstanbulDay(r.created_at) === today);
}

/**
 * Aktif görevler için hatırlatma ve gecikme bildirimlerini işler.
 */
async function processWorkTaskReminders() {
  const now = new Date();
  const tasks = await WorkTask.findAll({
    where: { status: 'active' },
    include: [{ model: User, as: 'Assignee', attributes: ['id', 'email', 'phone', 'full_name', 'tenant_id', 'is_active'] }],
  });

  let reminders = 0;
  let overdues = 0;

  for (const task of tasks) {
    const assignee = task.Assignee;
    if (!assignee || !assignee.is_active) continue;
    if (isOccurrenceComplete(task)) continue;

    const chs = channels(task);
    if (chs.length === 0) continue;

    const due = new Date(task.next_due_at);
    const remindAt = new Date(due.getTime() - (task.remind_before_minutes || 1440) * 60 * 1000);

    if (now >= remindAt && now <= due) {
      for (const channel of chs) {
        const sent = await alreadySent(task.id, task.next_due_at, channel, 'reminder');
        if (sent) continue;
        const title = 'Görev hatırlatması';
        const body = `"${task.title}" görevi ${due.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} tarihine kadar tamamlanmalı.`;
        await dispatchChannel(task, assignee, channel, 'reminder', title, body);
        reminders += 1;
      }
      await task.update({ last_reminder_at: now });
    }

    if (now > due && task.is_mandatory) {
      for (const channel of chs) {
        const sentToday = await overdueSentToday(task.id, assignee.id, channel);
        if (sentToday) continue;
        const title = 'Geciken zorunlu görev';
        const body = `"${task.title}" görevi gecikti. Lütfen en kısa sürede tamamlayın veya durumu güncelleyin.`;
        await dispatchChannel(task, assignee, channel, 'overdue', title, body);
        overdues += 1;
      }
      await task.update({ last_overdue_notice_at: now });
    }
  }

  return { reminders, overdues, checked: tasks.length };
}

module.exports = {
  processWorkTaskReminders,
};
