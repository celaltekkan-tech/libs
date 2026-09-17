'use strict';

const { WorkTask, User } = require('../models');
const audit = require('../services/auditService');
const accessService = require('../services/accessService');
const {
  computeNextDueAt,
  normalizeNotifyChannels,
  isOccurrenceComplete,
} = require('../services/workTaskService');

const assigneeInclude = {
  model: User,
  as: 'Assignee',
  attributes: ['id', 'full_name', 'email', 'phone'],
};

const creatorInclude = {
  model: User,
  as: 'Creator',
  attributes: ['id', 'full_name'],
  required: false,
};

function assertTenantAccess(req, row) {
  if (req.user && req.user.tenant_id && row.tenant_id !== req.user.tenant_id) return false;
  return true;
}

async function assertAssigneeInTenant(tenantId, assigneeUserId) {
  const user = await User.findOne({
    where: { id: assigneeUserId, tenant_id: tenantId, is_active: true, is_platform_admin: false },
  });
  return user;
}

function serializeTask(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  const due = new Date(data.next_due_at);
  const now = new Date();
  let due_state = 'upcoming';
  if (data.status === 'completed' || data.status === 'cancelled') due_state = data.status;
  else if (isOccurrenceComplete(data)) due_state = 'done_period';
  else if (now > due) due_state = 'overdue';
  else if (now >= new Date(due.getTime() - (data.remind_before_minutes || 0) * 60000)) due_state = 'due_soon';
  data.due_state = due_state;
  return data;
}

module.exports = {
  async list(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const where = { tenant_id: tenantId };

      if (String(req.query.mine || '') === 'true') {
        where.assignee_user_id = req.user.user_id;
      }
      if (req.query.status) where.status = String(req.query.status);
      if (String(req.query.mandatory || '') === 'true') where.is_mandatory = true;

      const rows = await WorkTask.findAll({
        where,
        include: [assigneeInclude, creatorInclude],
        order: [['next_due_at', 'ASC']],
        limit: 500,
      });

      let data = rows.map(serializeTask);
      if (String(req.query.overdue || '') === 'true') {
        data = data.filter((t) => t.due_state === 'overdue');
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id, {
        include: [assigneeInclude, creatorInclude],
      });
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: serializeTask(row) });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const body = req.validatedBody || req.body;
      const assignee = await assertAssigneeInTenant(tenantId, body.assignee_user_id);
      if (!assignee) {
        return res.status(400).json({ success: false, message: 'Atanan kullanıcı bu kurumda bulunamadı' });
      }

      const row = await WorkTask.create({
        tenant_id: tenantId,
        title: body.title,
        description: body.description || null,
        assignee_user_id: body.assignee_user_id,
        created_by: req.user.user_id || null,
        frequency: body.frequency || 'once',
        recurrence_config: body.recurrence_config || null,
        next_due_at: body.next_due_at,
        remind_before_minutes: body.remind_before_minutes ?? 1440,
        is_mandatory: Boolean(body.is_mandatory),
        notify_channels: normalizeNotifyChannels(body.notify_channels),
        status: 'active',
      });

      await audit.log(req, {
        action: 'create',
        entityType: 'work_task',
        entityId: row.id,
        summary: `İş takip görevi oluşturuldu: ${row.title}`,
      });

      const full = await WorkTask.findByPk(row.id, { include: [assigneeInclude, creatorInclude] });
      res.status(201).json({ success: true, data: serializeTask(full) });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const body = req.validatedBody || req.body;
      const tenantId = req.user.tenant_id;

      if (body.assignee_user_id != null) {
        const assignee = await assertAssigneeInTenant(tenantId, body.assignee_user_id);
        if (!assignee) {
          return res.status(400).json({ success: false, message: 'Atanan kullanıcı bu kurumda bulunamadı' });
        }
      }

      const patch = {};
      if (body.title != null) patch.title = body.title;
      if (body.description !== undefined) patch.description = body.description || null;
      if (body.assignee_user_id != null) patch.assignee_user_id = body.assignee_user_id;
      if (body.frequency != null) patch.frequency = body.frequency;
      if (body.recurrence_config !== undefined) patch.recurrence_config = body.recurrence_config;
      if (body.next_due_at != null) patch.next_due_at = body.next_due_at;
      if (body.remind_before_minutes != null) patch.remind_before_minutes = body.remind_before_minutes;
      if (body.is_mandatory != null) patch.is_mandatory = body.is_mandatory;
      if (body.notify_channels != null) patch.notify_channels = normalizeNotifyChannels(body.notify_channels);
      if (body.status != null) patch.status = body.status;

      await row.update(patch);

      await audit.log(req, {
        action: 'update',
        entityType: 'work_task',
        entityId: row.id,
        summary: `İş takip görevi güncellendi: ${row.title}`,
      });

      const full = await WorkTask.findByPk(row.id, { include: [assigneeInclude, creatorInclude] });
      res.json({ success: true, data: serializeTask(full) });
    } catch (err) {
      next(err);
    }
  },

  async complete(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }

      const isAssignee = row.assignee_user_id === req.user.user_id;
      const access = await accessService.getUserAccess(req.user.user_id);
      const canManage = access?.permissions?.includes('work_tasks.update');
      if (!isAssignee && !canManage) {
        return res.status(403).json({ success: false, message: 'Bu görevi tamamlama yetkiniz yok' });
      }

      const now = new Date();
      const patch = { last_completed_at: now };

      if (row.frequency === 'once') {
        patch.status = 'completed';
      } else {
        patch.next_due_at = computeNextDueAt(row.next_due_at, row.frequency, row.recurrence_config);
        patch.last_reminder_at = null;
        patch.last_overdue_notice_at = null;
      }

      await row.update(patch);

      await audit.log(req, {
        action: 'update',
        entityType: 'work_task',
        entityId: row.id,
        summary: `İş takip görevi tamamlandı: ${row.title}`,
      });

      const full = await WorkTask.findByPk(row.id, { include: [assigneeInclude, creatorInclude] });
      res.json({ success: true, data: serializeTask(full) });
    } catch (err) {
      next(err);
    }
  },

  async pause(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      await row.update({ status: 'paused' });
      res.json({ success: true, data: serializeTask(row) });
    } catch (err) {
      next(err);
    }
  },

  async resume(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      await row.update({ status: 'active' });
      res.json({ success: true, data: serializeTask(row) });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const row = await WorkTask.findByPk(req.params.id);
      if (!row) return res.status(404).json({ success: false, message: 'Görev bulunamadı' });
      if (!assertTenantAccess(req, row)) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      const label = row.title;
      await row.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'work_task',
        entityId: Number(req.params.id),
        summary: `İş takip görevi silindi: ${label}`,
      });
      res.json({ success: true, message: 'Silindi' });
    } catch (err) {
      next(err);
    }
  },
};
