'use strict';

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Op } = require('sequelize');
const {
  Feedback,
  FeedbackAttachment,
  FeedbackUpdate,
  FeedbackSyncState,
  FeedbackSyncTombstone,
  Tenant,
  User,
  Notification,
  sequelize,
} = require('../models');
const { FEEDBACK_STATUSES } = require('../validators/feedback.validator');
const { absolutePath, ensureUploadDir, removeStoredFile } = require('./feedbackUpload');

const PAGE_SIZE = 40;
const OVERLAP_MS = 2 * 60 * 1000;
const NOTIFY_WINDOW_MS = 36 * 60 * 60 * 1000;
const MAX_PAGES = 40;
const ADVISORY_LOCK = 74839201;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITIES = ['feedback', 'update', 'attachment', 'tombstone'];

function currentEnvName() {
  const raw = String(process.env.FEEDBACK_SYNC_ENV || '').trim().toLowerCase();
  if (/^[a-z0-9_-]{1,16}$/.test(raw)) return raw;
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

function syncSecret() {
  const secret = String(process.env.FEEDBACK_SYNC_SECRET || '');
  return secret.length >= 16 ? secret : '';
}

function peerBase() {
  return String(process.env.FEEDBACK_SYNC_PEER_URL || '').trim().replace(/\/+$/, '');
}

function syncExplicitlyOff() {
  return String(process.env.FEEDBACK_SYNC_ENABLED || 'true').toLowerCase() === 'false';
}

function syncConfigured() {
  return !syncExplicitlyOff() && Boolean(peerBase()) && Boolean(syncSecret());
}

function emptyCursor() {
  return { since: null, after: null };
}

function normalizeCursor(value) {
  const since = value && value.since ? new Date(value.since) : null;
  const after = value && typeof value.after === 'string' && UUID_RE.test(value.after) ? value.after : null;
  return {
    since: since && !Number.isNaN(since.getTime()) ? since.toISOString() : null,
    after,
  };
}

function cursorsOf(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const side = (name) => {
    const block = src[name] && typeof src[name] === 'object' ? src[name] : {};
    return {
      feedback: normalizeCursor(block.feedback),
      update: normalizeCursor(block.update),
      attachment: normalizeCursor(block.attachment),
      tombstone: normalizeCursor(block.tombstone),
    };
  };
  return { pull: side('pull'), push: side('push') };
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function asDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isRecent(value) {
  const d = asDate(value);
  if (!d) return false;
  const age = Date.now() - d.getTime();
  return age >= -OVERLAP_MS && age < NOTIFY_WINDOW_MS;
}

function isNewer(remoteAt, localAt) {
  const remote = asDate(remoteAt);
  const local = asDate(localAt);
  if (!remote) return false;
  if (!local) return true;
  return remote.getTime() > local.getTime();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function timeClause(timeField, cursor) {
  const since = cursor.since ? new Date(cursor.since) : new Date(0);
  if (!cursor.after) {
    return { [timeField]: { [Op.gte]: since } };
  }
  return {
    [Op.or]: [
      { [timeField]: { [Op.gt]: since } },
      { [Op.and]: [{ [timeField]: since }, { public_id: { [Op.gt]: cursor.after } }] },
    ],
  };
}

function pageInfo(rows, timeField) {
  if (rows.length === 0) {
    return { has_more: false, last_at: null, last_id: null };
  }
  const last = rows[rows.length - 1];
  return {
    has_more: rows.length === PAGE_SIZE,
    last_at: new Date(last[timeField]).toISOString(),
    last_id: last.public_id,
  };
}

function nextCursor(info, exportedAt) {
  if (info.has_more && info.last_at && info.last_id) {
    return { since: info.last_at, after: info.last_id };
  }
  return { since: exportedAt, after: null };
}

function requestCursor(cursor) {
  if (cursor.after) return { since: cursor.since, after: cursor.after };
  if (!cursor.since) return { since: new Date(0).toISOString(), after: null };
  return {
    since: new Date(new Date(cursor.since).getTime() - OVERLAP_MS).toISOString(),
    after: null,
  };
}

async function getState() {
  const [row] = await FeedbackSyncState.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, cursors: {} },
  });
  return row;
}

async function exportChanges(body = {}) {
  const requested = cursorsOf({ pull: body.cursors || {} }).pull;
  const exportedAt = new Date().toISOString();
  const env = currentEnvName();

  const feedbacks = await Feedback.findAll({
    where: {
      [Op.and]: [
        timeClause('updated_at', requested.feedback),
        sequelize.literal(
          'NOT EXISTS (SELECT 1 FROM "FeedbackSyncTombstones" t WHERE t.public_id = "Feedback"."public_id")'
        ),
      ],
    },
    order: [
      ['updated_at', 'ASC'],
      ['public_id', 'ASC'],
    ],
    limit: PAGE_SIZE,
  });

  const updates = await FeedbackUpdate.findAll({
    where: timeClause('updated_at', requested.update),
    include: [{ model: Feedback, attributes: ['public_id'], required: true }],
    order: [
      ['updated_at', 'ASC'],
      ['public_id', 'ASC'],
    ],
    limit: PAGE_SIZE,
  });

  const attachments = await FeedbackAttachment.findAll({
    where: timeClause('updated_at', requested.attachment),
    include: [{ model: Feedback, attributes: ['public_id'], required: true }],
    order: [
      ['updated_at', 'ASC'],
      ['public_id', 'ASC'],
    ],
    limit: PAGE_SIZE,
  });

  const tombstones = await FeedbackSyncTombstone.findAll({
    where: {
      [Op.and]: [{ origin_env: env }, timeClause('deleted_at', requested.tombstone)],
    },
    order: [
      ['deleted_at', 'ASC'],
      ['public_id', 'ASC'],
    ],
    limit: PAGE_SIZE,
  });

  return {
    env,
    exported_at: exportedAt,
    feedbacks: feedbacks.map(serializeFeedback),
    updates: updates.map(serializeUpdate),
    attachments: attachments.map(serializeAttachment),
    tombstones: tombstones.map((row) => ({
      public_id: row.public_id,
      origin_env: row.origin_env,
      deleted_at: row.deleted_at,
    })),
    page: {
      feedback: pageInfo(feedbacks, 'updated_at'),
      update: pageInfo(updates, 'updated_at'),
      attachment: pageInfo(attachments, 'updated_at'),
      tombstone: pageInfo(tombstones, 'deleted_at'),
    },
  };
}

function serializeFeedback(row) {
  return {
    public_id: row.public_id,
    message: row.message,
    page_path: row.page_path,
    page_title: row.page_title,
    status: row.status,
    reply: row.reply,
    replied_at: row.replied_at,
    cancel_reason: row.cancel_reason,
    author_name: row.author_name,
    author_email: row.author_email,
    tenant_name: row.tenant_name,
    origin_env: row.origin_env || currentEnvName(),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeUpdate(row) {
  return {
    public_id: row.public_id,
    feedback_public_id: row.Feedback ? row.Feedback.public_id : null,
    body: row.body,
    is_from_platform: row.is_from_platform,
    author_name: row.author_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeAttachment(row) {
  return {
    public_id: row.public_id,
    feedback_public_id: row.Feedback ? row.Feedback.public_id : null,
    original_name: row.original_name,
    stored_name: row.stored_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function writeTimestamps(table, publicId, createdAt, updatedAt) {
  const created = asDate(createdAt);
  const updated = asDate(updatedAt);
  if (!created || !updated) return;
  await sequelize.query(
    `UPDATE "${table}" SET created_at = :createdAt, updated_at = :updatedAt WHERE public_id = :publicId`,
    { replacements: { createdAt: created, updatedAt: updated, publicId } }
  );
}

async function resolveLinks(remote) {
  let tenantId = null;
  let userId = null;
  const tenantName = remote.tenant_name ? String(remote.tenant_name).trim() : '';
  const email = remote.author_email ? String(remote.author_email).trim() : '';

  if (tenantName) {
    const tenant = await Tenant.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), tenantName.toLowerCase()),
      attributes: ['id'],
    });
    if (tenant) tenantId = tenant.id;
  }

  if (email) {
    const user = await User.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email.toLowerCase()),
      attributes: ['id', 'tenant_id'],
    });
    if (user) {
      userId = user.id;
      if (!tenantId) tenantId = user.tenant_id;
    }
  }

  return { tenantId, userId };
}

async function notifyOwner(userId, tenantId, title, body) {
  if (!userId) return;
  await Notification.create({
    recipient_user_id: userId,
    tenant_id: tenantId || null,
    sender_user_id: null,
    title,
    body,
  });
}

async function applyFeedback(remote) {
  if (!isUuid(remote.public_id) || !remote.message || !FEEDBACK_STATUSES.includes(remote.status)) {
    return 'skip';
  }
  const dead = await FeedbackSyncTombstone.findByPk(remote.public_id);
  if (dead) return 'skip';

  const local = await Feedback.findOne({ where: { public_id: remote.public_id } });
  if (local && !isNewer(remote.updated_at, local.updated_at)) return 'skip';

  const links = await resolveLinks(remote);
  const previousReply = local ? local.reply : null;
  const createdAt = asDate(remote.created_at) || new Date();
  const updatedAt = asDate(remote.updated_at) || createdAt;
  const fields = {
    message: remote.message,
    page_path: remote.page_path || null,
    page_title: remote.page_title || null,
    status: remote.status,
    reply: remote.reply || null,
    replied_at: asDate(remote.replied_at),
    cancel_reason: remote.cancel_reason || null,
    author_name: remote.author_name || null,
    author_email: remote.author_email || null,
    tenant_name: remote.tenant_name || null,
    origin_env: (local && local.origin_env) || remote.origin_env || null,
  };
  if (links.tenantId) fields.tenant_id = links.tenantId;
  if (links.userId) fields.user_id = links.userId;

  if (!local) {
    const created = await Feedback.create(
      {
        ...fields,
        public_id: remote.public_id,
        tenant_id: links.tenantId,
        user_id: links.userId,
        created_at: createdAt,
        updated_at: updatedAt,
      },
      { silent: true }
    );
    await writeTimestamps('Feedbacks', created.public_id, createdAt, updatedAt);
  } else {
    await local.update(fields, { silent: true });
    await writeTimestamps('Feedbacks', local.public_id, createdAt, updatedAt);
  }

  const ownerId = links.userId || (local && local.user_id) || null;
  const tenantId = links.tenantId || (local && local.tenant_id) || null;
  if (remote.reply && remote.reply !== previousReply && ownerId && isRecent(remote.updated_at)) {
    await notifyOwner(
      ownerId,
      tenantId,
      'Geri bildiriminize yanıt verildi',
      'Gönderdiğiniz geri bildirime platform tarafından yanıt verildi. Detay için Geri Bildirim sayfasına bakın.'
    );
  }
  return 'applied';
}

async function applyUpdate(remote) {
  if (!isUuid(remote.public_id) || !isUuid(remote.feedback_public_id) || !remote.body) return 'skip';
  const parent = await Feedback.findOne({ where: { public_id: remote.feedback_public_id } });
  if (!parent) {
    const dead = await FeedbackSyncTombstone.findByPk(remote.feedback_public_id);
    return dead ? 'skip' : 'hold';
  }

  const local = await FeedbackUpdate.findOne({ where: { public_id: remote.public_id } });
  if (local && !isNewer(remote.updated_at, local.updated_at)) return 'skip';
  const createdAt = asDate(remote.created_at) || new Date();
  const updatedAt = asDate(remote.updated_at) || createdAt;

  if (!local) {
    const created = await FeedbackUpdate.create(
      {
        public_id: remote.public_id,
        feedback_id: parent.id,
        user_id: null,
        body: remote.body,
        is_from_platform: Boolean(remote.is_from_platform),
        author_name: remote.author_name || null,
        created_at: createdAt,
        updated_at: updatedAt,
      },
      { silent: true }
    );
    await writeTimestamps('FeedbackUpdates', created.public_id, createdAt, updatedAt);
    if (remote.is_from_platform && parent.user_id && isRecent(remote.updated_at)) {
      await notifyOwner(
        parent.user_id,
        parent.tenant_id,
        'Geri bildiriminize yeni gelişme eklendi',
        'Gönderdiğiniz geri bildirime platform tarafından yeni bir gelişme eklendi. Detay için Geri Bildirim sayfasına bakın.'
      );
    }
  } else {
    await local.update(
      {
        body: remote.body,
        is_from_platform: Boolean(remote.is_from_platform),
        author_name: remote.author_name || local.author_name,
      },
      { silent: true }
    );
    await writeTimestamps('FeedbackUpdates', local.public_id, createdAt, updatedAt);
  }
  return 'applied';
}

async function storedNameFor(remote) {
  const wanted = path.basename(String(remote.stored_name || ''));
  const ext = path.extname(String(remote.original_name || wanted || ''));
  const fallback = `${remote.public_id}${ext}`;
  if (!wanted) return fallback;
  const clash = await FeedbackAttachment.findOne({ where: { stored_name: wanted } });
  if (clash && clash.public_id !== remote.public_id) return fallback;
  return wanted;
}

function fileExists(storedName) {
  if (!storedName) return false;
  try {
    return fs.existsSync(absolutePath(storedName));
  } catch {
    return false;
  }
}

async function applyAttachment(remote) {
  if (!isUuid(remote.public_id) || !isUuid(remote.feedback_public_id)) return { status: 'skip' };
  if (!remote.original_name || !remote.mime_type) return { status: 'skip' };
  const parent = await Feedback.findOne({ where: { public_id: remote.feedback_public_id } });
  if (!parent) {
    const dead = await FeedbackSyncTombstone.findByPk(remote.feedback_public_id);
    return { status: dead ? 'skip' : 'hold' };
  }

  const local = await FeedbackAttachment.findOne({ where: { public_id: remote.public_id } });
  if (local && !isNewer(remote.updated_at, local.updated_at)) {
    return { status: 'skip', missing: !fileExists(local.stored_name), publicId: local.public_id };
  }

  const storedName = local ? local.stored_name : await storedNameFor(remote);
  const createdAt = asDate(remote.created_at) || new Date();
  const updatedAt = asDate(remote.updated_at) || createdAt;
  const fields = {
    original_name: remote.original_name,
    stored_name: storedName,
    mime_type: remote.mime_type,
    size_bytes: Number(remote.size_bytes) || 0,
  };

  if (!local) {
    const created = await FeedbackAttachment.create(
      {
        ...fields,
        public_id: remote.public_id,
        feedback_id: parent.id,
        created_at: createdAt,
        updated_at: updatedAt,
      },
      { silent: true }
    );
    await writeTimestamps('FeedbackAttachments', created.public_id, createdAt, updatedAt);
  } else {
    await local.update(fields, { silent: true });
    await writeTimestamps('FeedbackAttachments', local.public_id, createdAt, updatedAt);
  }

  return {
    status: 'applied',
    missing: !fileExists(storedName),
    publicId: remote.public_id,
  };
}

async function applyTombstone(remote) {
  if (!isUuid(remote.public_id)) return 'skip';
  const deletedAt = asDate(remote.deleted_at) || new Date();
  const origin = remote.origin_env || 'peer';

  const names = [];
  await sequelize.transaction(async (transaction) => {
    const existing = await FeedbackSyncTombstone.findByPk(remote.public_id, { transaction });
    if (!existing) {
      await FeedbackSyncTombstone.create(
        { public_id: remote.public_id, origin_env: origin, deleted_at: deletedAt },
        { transaction }
      );
    }
    const feedback = await Feedback.findOne({
      where: { public_id: remote.public_id },
      include: [{ model: FeedbackAttachment, as: 'Attachments' }],
      transaction,
    });
    if (!feedback) return;
    (feedback.Attachments || []).forEach((row) => names.push(row.stored_name));
    await feedback.destroy({ transaction });
  });
  names.forEach((name) => removeStoredFile(name));
  return 'applied';
}

async function importChanges(body = {}) {
  const feedbacks = Array.isArray(body.feedbacks) ? body.feedbacks.slice(0, 100) : [];
  const updates = Array.isArray(body.updates) ? body.updates.slice(0, 100) : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 100) : [];
  const tombstones = Array.isArray(body.tombstones) ? body.tombstones.slice(0, 100) : [];

  const applied = { feedbacks: 0, updates: 0, attachments: 0, tombstones: 0 };
  let holdUpdate = false;
  let holdAttachment = false;
  const missingFiles = [];

  for (const row of feedbacks) {
    if ((await applyFeedback(row)) === 'applied') applied.feedbacks += 1;
  }
  for (const row of updates) {
    const result = await applyUpdate(row);
    if (result === 'applied') applied.updates += 1;
    if (result === 'hold') holdUpdate = true;
  }
  for (const row of attachments) {
    const result = await applyAttachment(row);
    if (result.status === 'applied') applied.attachments += 1;
    if (result.status === 'hold') holdAttachment = true;
    if (result.missing && result.publicId) missingFiles.push(result.publicId);
  }
  for (const row of tombstones) {
    if ((await applyTombstone(row)) === 'applied') applied.tombstones += 1;
  }

  return {
    applied,
    missing_files: missingFiles,
    hold_update_cursor: holdUpdate,
    hold_attachment_cursor: holdAttachment,
  };
}

async function peerFetch(urlPath, options = {}) {
  const base = peerBase();
  const secret = syncSecret();
  if (!base || !secret) throw httpError(503, 'Geri bildirim senkronu yapılandırılmamış');

  let response;
  try {
    response = await fetch(`${base}${urlPath}`, {
      ...options,
      headers: {
        'X-Feedback-Sync-Token': secret,
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(Number(process.env.FEEDBACK_SYNC_TIMEOUT_MS || 60000)),
    });
  } catch (err) {
    throw httpError(502, `Karşı ortama ulaşılamadı: ${err.message}`);
  }

  if (!response.ok) {
    let message = `Karşı ortam ${response.status} döndü`;
    try {
      const payload = await response.json();
      if (payload && payload.message) message = payload.message;
    } catch {
      // gövde JSON değilse durum kodu yeterli
    }
    throw httpError(response.status === 401 ? 401 : 502, message);
  }
  return response;
}

async function pullOnce(cursors) {
  const response = await peerFetch('/api/feedback/sync/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cursors: {
        feedback: requestCursor(cursors.feedback),
        update: requestCursor(cursors.update),
        attachment: requestCursor(cursors.attachment),
        tombstone: requestCursor(cursors.tombstone),
      },
    }),
  });
  const payload = await response.json();
  if (!payload || payload.success !== true || !payload.data) {
    throw httpError(502, 'Karşı ortamın dışa aktarımı okunamadı');
  }
  const page = payload.data;
  const imported = await importChanges(page);
  await downloadMissingFiles(imported.missing_files);
  return { page, imported };
}

async function pushOnce(cursors) {
  const page = await exportChanges({
    cursors: {
      feedback: requestCursor(cursors.feedback),
      update: requestCursor(cursors.update),
      attachment: requestCursor(cursors.attachment),
      tombstone: requestCursor(cursors.tombstone),
    },
  });
  const response = await peerFetch('/api/feedback/sync/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(page),
  });
  const payload = await response.json();
  if (!payload || payload.success !== true || !payload.data) {
    throw httpError(502, 'Karşı ortam içe aktarımı doğrulamadı');
  }
  const uploaded = await uploadMissingFiles(payload.data.missing_files || []);
  return { page, imported: payload.data, uploaded };
}

async function downloadMissingFiles(publicIds) {
  let count = 0;
  for (const publicId of publicIds || []) {
    if (!isUuid(publicId)) continue;
    const row = await FeedbackAttachment.findOne({ where: { public_id: publicId } });
    if (!row || fileExists(row.stored_name)) continue;
    const response = await peerFetch(`/api/feedback/sync/files/${publicId}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    ensureUploadDir();
    fs.writeFileSync(absolutePath(row.stored_name), bytes);
    count += 1;
  }
  return count;
}

async function uploadMissingFiles(publicIds) {
  let count = 0;
  for (const publicId of publicIds || []) {
    if (!isUuid(publicId)) continue;
    const row = await FeedbackAttachment.findOne({ where: { public_id: publicId } });
    if (!row || !fileExists(row.stored_name)) continue;
    const bytes = fs.readFileSync(absolutePath(row.stored_name));
    await peerFetch(`/api/feedback/sync/files/${publicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    });
    count += 1;
  }
  return count;
}

function anyHasMore(page) {
  return ENTITIES.some((name) => page.page && page.page[name] && page.page[name].has_more);
}

function advanceCursors(prev, page, imported) {
  const exportedAt = page.exported_at || new Date().toISOString();
  const next = {
    feedback: nextCursor(page.page.feedback, exportedAt),
    update: nextCursor(page.page.update, exportedAt),
    attachment: nextCursor(page.page.attachment, exportedAt),
    tombstone: nextCursor(page.page.tombstone, exportedAt),
  };
  if (imported && imported.hold_update_cursor) next.update = prev.update;
  if (imported && imported.hold_attachment_cursor) next.attachment = prev.attachment;
  return next;
}

async function exchange(direction, cursors) {
  const totals = { feedbacks: 0, updates: 0, attachments: 0, tombstones: 0, files: 0 };
  let holdStreak = 0;
  let current = cursors;

  for (let i = 0; i < MAX_PAGES; i += 1) {
    const step = direction === 'pull' ? await pullOnce(current) : await pushOnce(current);
    const applied = step.imported.applied || {};
    totals.feedbacks += applied.feedbacks || 0;
    totals.updates += applied.updates || 0;
    totals.attachments += applied.attachments || 0;
    totals.tombstones += applied.tombstones || 0;
    totals.files += direction === 'pull' ? (step.imported.missing_files || []).length : step.uploaded || 0;

    const held = step.imported.hold_update_cursor || step.imported.hold_attachment_cursor;
    const next = advanceCursors(current, step.page, step.imported);
    if (held) {
      holdStreak += 1;
      if (holdStreak >= 3) {
        next.update = nextCursor(step.page.page.update, step.page.exported_at);
        next.attachment = nextCursor(step.page.page.attachment, step.page.exported_at);
        holdStreak = 0;
      }
    } else {
      holdStreak = 0;
    }
    current = next;
    if (!anyHasMore(step.page) && !held) break;
  }

  return { cursors: current, totals };
}

async function withLock(fn) {
  const [rows] = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS locked', {
    replacements: { key: ADVISORY_LOCK },
  });
  if (!rows[0] || !rows[0].locked) {
    return { ok: false, skipped: true, error: 'Senkron zaten çalışıyor' };
  }
  try {
    return await fn();
  } finally {
    await sequelize.query('SELECT pg_advisory_unlock(:key)', { replacements: { key: ADVISORY_LOCK } });
  }
}

async function runFeedbackSync() {
  if (!syncConfigured()) {
    return {
      ok: false,
      enabled: false,
      env: currentEnvName(),
      error: syncExplicitlyOff()
        ? 'Senkron FEEDBACK_SYNC_ENABLED=false ile kapatılmış'
        : 'FEEDBACK_SYNC_PEER_URL ve en az 16 karakterlik FEEDBACK_SYNC_SECRET gerekli',
    };
  }

  return withLock(async () => {
    const state = await getState();
    const cursors = cursorsOf(state.cursors);
    await state.update({ last_run_at: new Date(), last_error: null });

    try {
      const pulled = await exchange('pull', cursors.pull);
      const pushed = await exchange('push', cursors.push);
      const summary = {
        ok: true,
        pulled: pulled.totals,
        pushed: pushed.totals,
      };
      await state.update({
        cursors: { pull: pulled.cursors, push: pushed.cursors },
        last_success_at: new Date(),
        last_error: null,
        last_summary: summary,
      });
      console.log(
        `[feedback-sync] pull f=${pulled.totals.feedbacks} u=${pulled.totals.updates} push f=${pushed.totals.feedbacks} u=${pushed.totals.updates}`
      );
      return { ok: true, enabled: true, env: currentEnvName(), ...summary };
    } catch (err) {
      const message = err.message || 'Senkron başarısız';
      await state.update({ last_error: message, last_summary: { ok: false, error: message } });
      console.error('[feedback-sync]', message);
      return { ok: false, enabled: true, env: currentEnvName(), error: message };
    }
  });
}

async function getSyncStatus() {
  let state = null;
  try {
    state = await FeedbackSyncState.findByPk(1);
  } catch {
    state = null;
  }
  return {
    enabled: syncConfigured(),
    env: currentEnvName(),
    peer_configured: Boolean(peerBase()) && Boolean(syncSecret()),
    last_run_at: state ? state.last_run_at : null,
    last_success_at: state ? state.last_success_at : null,
    last_error: state ? state.last_error : null,
    last_summary: state ? state.last_summary : null,
  };
}

async function rememberFeedbackDeletion(publicId, transaction) {
  if (!isUuid(publicId)) return;
  const existing = await FeedbackSyncTombstone.findByPk(publicId, { transaction });
  if (existing) return;
  await FeedbackSyncTombstone.create(
    {
      public_id: publicId,
      origin_env: currentEnvName(),
      deleted_at: new Date(),
    },
    { transaction }
  );
}

async function sendSyncFile(publicId, res) {
  if (!isUuid(publicId)) throw httpError(400, 'Geçersiz kimlik');
  const row = await FeedbackAttachment.findOne({ where: { public_id: publicId } });
  if (!row || !fileExists(row.stored_name)) throw httpError(404, 'Dosya bulunamadı');
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.sendFile(absolutePath(row.stored_name));
}

async function receiveSyncFile(publicId, body) {
  if (!isUuid(publicId)) throw httpError(400, 'Geçersiz kimlik');
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (!bytes.length) throw httpError(400, 'Dosya boş');
  if (bytes.length > 5 * 1024 * 1024) throw httpError(400, 'Dosya boyutu en fazla 5 MB olabilir');

  const row = await FeedbackAttachment.findOne({ where: { public_id: publicId } });
  if (!row) throw httpError(404, 'Ek kaydı bulunamadı');
  ensureUploadDir();
  fs.writeFileSync(absolutePath(row.stored_name), bytes);
}

function startFeedbackSyncCron() {
  if (!syncConfigured()) {
    console.log(
      'Feedback sync off (set FEEDBACK_SYNC_PEER_URL and FEEDBACK_SYNC_SECRET, or FEEDBACK_SYNC_ENABLED=false)'
    );
    return;
  }
  const expr = process.env.FEEDBACK_SYNC_CRON || '*/5 * * * *';
  if (!cron.validate(expr)) {
    console.warn(`Invalid FEEDBACK_SYNC_CRON "${expr}", feedback sync not scheduled`);
    return;
  }
  cron.schedule(
    expr,
    () => {
      runFeedbackSync().catch((err) => console.error('[feedback-sync]', err.message));
    },
    { timezone: 'Europe/Istanbul' }
  );
  console.log(`Feedback sync cron scheduled: ${expr} (${currentEnvName()} -> ${peerBase()})`);
}

module.exports = {
  currentEnvName,
  syncConfigured,
  exportChanges,
  importChanges,
  runFeedbackSync,
  getSyncStatus,
  rememberFeedbackDeletion,
  sendSyncFile,
  receiveSyncFile,
  startFeedbackSyncCron,
};
