'use strict';

const cron = require('node-cron');
const { sequelize, Tenant } = require('../models');
const { fillMissingDemoData } = require('./demoDataFill');

const DEMO_TENANT_NAME = 'Demo Eğitim Kurumu';
const TIMEZONE = 'Europe/Istanbul';
const DEFAULT_TIME = '03:00';
const EXCLUDE_TABLES = new Set(['Licenses', 'AiUsageDaily', 'Tenants', 'DemoResetSettings']);

let scheduledTask = null;
let inFlight = null;

function isIdent(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ''));
}

function q(name) {
  if (!isIdent(name)) throw new Error(`Geçersiz tablo adı: ${name}`);
  return `"${name}"`;
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''));
}

function cronExprFromTime(hhmm) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return `${Number(match[2])} ${Number(match[1])} * * *`;
}

function serializeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

function isReplicaDenied(err) {
  const message = String(err && (err.parent?.message || err.message) || '');
  return err?.parent?.code === '42501' || /session_replication_role|permission denied|must be superuser/i.test(message);
}

async function findDemoTenant() {
  const [flagged] = await sequelize.query(
    `SELECT id FROM "Tenants" WHERE COALESCE(data->>'demo', '') = 'true' ORDER BY id ASC LIMIT 1`
  );
  let tenant = flagged[0] ? await Tenant.findByPk(flagged[0].id) : null;
  if (!tenant) {
    tenant = await Tenant.findOne({ where: { name: DEMO_TENANT_NAME } });
  }
  if (!tenant) return null;
  const data = tenant.data && typeof tenant.data === 'object' ? tenant.data : {};
  if (data.demo !== true) {
    await tenant.update({ data: { ...data, demo: true } });
  }
  return tenant;
}

async function getSettings({ withSnapshot = false } = {}) {
  const DemoResetSetting = sequelize.models.DemoResetSetting;
  const options = withSnapshot ? {} : { attributes: { exclude: ['snapshot'] } };
  let row = await DemoResetSetting.findByPk(1, options);
  if (!row) {
    await DemoResetSetting.create({ id: 1, schedule_time: DEFAULT_TIME });
    row = await DemoResetSetting.findByPk(1, options);
  }
  return row;
}

function publicStatus(tenant, row) {
  return {
    tenant_id: tenant ? tenant.id : null,
    tenant_name: tenant ? tenant.name : null,
    schedule_time: row.schedule_time || DEFAULT_TIME,
    timezone: TIMEZONE,
    has_snapshot: Boolean(row.snapshot_taken_at),
    snapshot_taken_at: row.snapshot_taken_at || null,
    last_reset_at: row.last_reset_at || null,
    last_reset_trigger: row.last_reset_trigger || null,
    last_reset_summary: row.last_reset_summary || null,
  };
}

async function listFkEdges(transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT
      c.relname AS child_table,
      a.attname AS child_column,
      fc.relname AS parent_table,
      fa.attname AS parent_column
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class fc ON fc.oid = con.confrelid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
    JOIN pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = fk.attnum
    WHERE con.contype = 'f' AND n.nspname = 'public'
    `,
    { transaction }
  );
  return rows.filter(
    (row) =>
      isIdent(row.child_table) &&
      isIdent(row.parent_table) &&
      isIdent(row.child_column) &&
      isIdent(row.parent_column)
  );
}

async function listTenantTables(transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
    `,
    { transaction }
  );
  return rows
    .map((row) => row.table_name)
    .filter((name) => !EXCLUDE_TABLES.has(name) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
}

function insertOrder(tables, edges) {
  const nodes = [...new Set(tables)];
  const indeg = new Map(nodes.map((table) => [table, 0]));
  const children = new Map(nodes.map((table) => [table, []]));
  const seen = new Set();
  for (const edge of edges) {
    if (!indeg.has(edge.child_table) || !indeg.has(edge.parent_table)) continue;
    if (edge.child_table === edge.parent_table) continue;
    const key = `${edge.parent_table}->${edge.child_table}`;
    if (seen.has(key)) continue;
    seen.add(key);
    indeg.set(edge.child_table, indeg.get(edge.child_table) + 1);
    children.get(edge.parent_table).push(edge.child_table);
  }
  const ready = nodes.filter((table) => indeg.get(table) === 0);
  const order = [];
  while (ready.length) {
    const table = ready.shift();
    order.push(table);
    for (const child of children.get(table)) {
      indeg.set(child, indeg.get(child) - 1);
      if (indeg.get(child) === 0) ready.push(child);
    }
  }
  if (order.length !== nodes.length) return null;
  return order;
}

async function selectRows(table, column, values, transaction) {
  const byId = new Map();
  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    if (!chunk.length) continue;
    const [rows] = await sequelize.query(
      `SELECT * FROM ${q(table)} WHERE ${q(column)} IN (:chunk)`,
      { replacements: { chunk }, transaction }
    );
    rows.forEach((row) => byId.set(Number(row.id), serializeRow(row)));
  }
  return [...byId.values()];
}

async function deleteByIds(table, ids, transaction) {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    if (!chunk.length) continue;
    await sequelize.query(`DELETE FROM ${q(table)} WHERE id IN (:chunk)`, {
      replacements: { chunk },
      transaction,
    });
  }
}

async function columnSet(table, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = :table
    `,
    { replacements: { table }, transaction }
  );
  return new Set(rows.map((row) => row.column_name));
}

async function insertRows(table, rows, transaction) {
  if (!rows || !rows.length) return;
  const columns = await columnSet(table, transaction);
  if (!columns.size) return;
  const cleaned = rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      if (columns.has(key)) out[key] = value;
    }
    return out;
  });
  for (let i = 0; i < cleaned.length; i += 200) {
    const slice = cleaned.slice(i, i + 200);
    await sequelize.query(
      `INSERT INTO ${q(table)} SELECT * FROM jsonb_populate_recordset(NULL::${q(table)}, $1::jsonb)`,
      { bind: [JSON.stringify(slice)], transaction }
    );
  }
}

async function bumpSequence(table, transaction) {
  const [rows] = await sequelize.query(`SELECT pg_get_serial_sequence(:reg, 'id') AS seq`, {
    replacements: { reg: `public.${q(table)}` },
    transaction,
  });
  const seq = rows[0] && rows[0].seq;
  if (!seq) return;
  const [maxRows] = await sequelize.query(`SELECT MAX(id) AS max_id FROM ${q(table)}`, { transaction });
  const maxId = maxRows[0] && maxRows[0].max_id != null ? Number(maxRows[0].max_id) : 0;
  if (!maxId) {
    await sequelize.query(`SELECT setval(:seq, 1, false)`, { replacements: { seq }, transaction });
    return;
  }
  await sequelize.query(`SELECT setval(:seq, :maxId, true)`, {
    replacements: { seq, maxId },
    transaction,
  });
}

async function collectGraph(tenantId, transaction) {
  const tenantTables = await listTenantTables(transaction);
  const tenantSet = new Set(tenantTables);
  const edges = await listFkEdges(transaction);
  const ids = new Map();
  const rowsByTable = new Map();

  for (const table of tenantTables) {
    const [rows] = await sequelize.query(`SELECT * FROM ${q(table)} WHERE tenant_id = :tenantId`, {
      replacements: { tenantId },
      transaction,
    });
    rowsByTable.set(table, rows.map(serializeRow));
    ids.set(table, new Set(rows.map((row) => Number(row.id))));
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of edges) {
      if (tenantSet.has(edge.child_table)) continue;
      const parentIds = ids.get(edge.parent_table);
      if (!parentIds || !parentIds.size) continue;
      const found = await selectRows(edge.child_table, edge.child_column, [...parentIds], transaction);
      if (!rowsByTable.has(edge.child_table)) rowsByTable.set(edge.child_table, []);
      if (!ids.has(edge.child_table)) ids.set(edge.child_table, new Set());
      const set = ids.get(edge.child_table);
      const bucket = rowsByTable.get(edge.child_table);
      const known = new Set(bucket.map((row) => Number(row.id)));
      for (const row of found) {
        const id = Number(row.id);
        if (!set.has(id)) {
          set.add(id);
          grew = true;
        }
        if (!known.has(id)) {
          known.add(id);
          bucket.push(row);
        }
      }
    }
  }

  return { tenantSet, edges, ids, rowsByTable };
}

async function deleteOwned(graph, tenantId, transaction) {
  const tables = [...graph.ids.keys()];
  const parentsFirst = insertOrder(tables, graph.edges);
  const order = parentsFirst ? [...parentsFirst].reverse() : tables;
  if (!parentsFirst) {
    const err = httpError(
      'Demo verisindeki ilişkiler döngülü. Geri alma için veritabanı kullanıcısının yetkisi yetersiz.',
      500
    );
    throw err;
  }
  for (const table of order) {
    if (graph.tenantSet.has(table)) {
      await sequelize.query(`DELETE FROM ${q(table)} WHERE tenant_id = :tenantId`, {
        replacements: { tenantId },
        transaction,
      });
    } else {
      await deleteByIds(table, [...graph.ids.get(table)], transaction);
    }
  }
  return order;
}

async function buildSnapshot(tenantId) {
  return sequelize.transaction(async (transaction) => {
    const graph = await collectGraph(tenantId, transaction);
    const tenant = await Tenant.findByPk(tenantId, { transaction });
    const tables = {};
    for (const [table, rows] of graph.rowsByTable) {
      tables[table] = rows;
    }
    return {
      version: 1,
      tenant_id: tenantId,
      tenant_fields: { menu_layout: tenant ? tenant.menu_layout ?? null : null },
      tables,
    };
  });
}

async function restoreSnapshot(tenantId, snapshot, { replica }) {
  await sequelize.transaction(async (transaction) => {
    if (replica) {
      await sequelize.query(`SET LOCAL session_replication_role = 'replica'`, { transaction });
    }
    const graph = await collectGraph(tenantId, transaction);
    let order;
    try {
      order = await deleteOwned(graph, tenantId, transaction);
    } catch (err) {
      if (!replica) throw err;
      const tables = [...graph.ids.keys()];
      for (const table of tables) {
        if (graph.tenantSet.has(table)) {
          await sequelize.query(`DELETE FROM ${q(table)} WHERE tenant_id = :tenantId`, {
            replacements: { tenantId },
            transaction,
          });
        } else {
          await deleteByIds(table, [...graph.ids.get(table)], transaction);
        }
      }
      order = tables;
    }

    const snapshotTables = Object.keys(snapshot.tables || {});
    const parentsFirst = insertOrder([...new Set([...order, ...snapshotTables])], graph.edges);
    const writeOrder = parentsFirst || (replica ? snapshotTables : null);
    if (!writeOrder) {
      throw httpError(
        'Demo verisindeki ilişkiler döngülü. Geri alma için veritabanı kullanıcısının yetkisi yetersiz.',
        500
      );
    }
    for (const table of writeOrder) {
      await insertRows(table, snapshot.tables[table], transaction);
    }
    for (const table of writeOrder) {
      if (snapshot.tables[table] || graph.ids.has(table)) await bumpSequence(table, transaction);
    }
    if (snapshot.tenant_fields && Object.prototype.hasOwnProperty.call(snapshot.tenant_fields, 'menu_layout')) {
      await sequelize.query(
        `UPDATE "Tenants" SET menu_layout = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        {
          bind: [
            snapshot.tenant_fields.menu_layout == null
              ? null
              : JSON.stringify(snapshot.tenant_fields.menu_layout),
            tenantId,
          ],
          transaction,
        }
      );
    }
  });
}

async function captureSnapshot(tenantId) {
  const snapshot = await buildSnapshot(tenantId);
  const DemoResetSetting = sequelize.models.DemoResetSetting;
  await DemoResetSetting.update(
    { snapshot, snapshot_taken_at: new Date() },
    { where: { id: 1 } }
  );
  return snapshot;
}

async function withLock(work) {
  if (inFlight) return inFlight;
  inFlight = work().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function resetDemoTenant(trigger) {
  return withLock(async () => {
    const tenant = await findDemoTenant();
    if (!tenant) throw httpError('Demo Eğitim Kurumu hesabı bulunamadı', 404);
    const row = await getSettings({ withSnapshot: true });
    const snapshot = row.snapshot;
    const sameTenant = snapshot && Number(snapshot.tenant_id) === Number(tenant.id);
    let restored = false;
    if (sameTenant) {
      try {
        await restoreSnapshot(tenant.id, snapshot, { replica: true });
      } catch (err) {
        if (!isReplicaDenied(err)) throw err;
        await restoreSnapshot(tenant.id, snapshot, { replica: false });
      }
      restored = true;
    }
    const added = await fillMissingDemoData(tenant.id);
    if (!sameTenant || added.length) await captureSnapshot(tenant.id);
    const summary = { restored, added };
    await sequelize.models.DemoResetSetting.update(
      {
        last_reset_at: new Date(),
        last_reset_trigger: trigger,
        last_reset_summary: summary,
      },
      { where: { id: 1 } }
    );
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      restored,
      added,
    };
  });
}

async function captureBaseline() {
  return withLock(async () => {
    const tenant = await findDemoTenant();
    if (!tenant) throw httpError('Demo Eğitim Kurumu hesabı bulunamadı', 404);
    const added = await fillMissingDemoData(tenant.id);
    await captureSnapshot(tenant.id);
    const fresh = await getSettings();
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      added,
      snapshot_taken_at: fresh.snapshot_taken_at,
    };
  });
}

async function getStatus() {
  const [tenant, row] = await Promise.all([findDemoTenant(), getSettings()]);
  return publicStatus(tenant, row);
}

async function updateSchedule(scheduleTime) {
  if (!isTime(scheduleTime)) throw httpError('Saat 24 saat biçiminde olmalıdır (ör. 03:00)', 400);
  await sequelize.models.DemoResetSetting.update({ schedule_time: scheduleTime }, { where: { id: 1 } });
  await rescheduleDemoCron();
  return getStatus();
}

async function ensureBaseline() {
  const tenant = await findDemoTenant();
  if (!tenant) {
    console.log('[demo-reset] Demo Eğitim Kurumu hesabı yok');
    return;
  }
  const row = await getSettings();
  if (row.snapshot_taken_at) return;
  const added = await fillMissingDemoData(tenant.id);
  await captureSnapshot(tenant.id);
  const detail = added.length ? added.join(', ') : 'eksik kayıt yok';
  console.log(`[demo-reset] başlangıç görüntüsü alındı (${detail})`);
}

async function rescheduleDemoCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (String(process.env.DEMO_RESET_CRON_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[demo-reset] zamanlanmış geri alma kapalı');
    return;
  }
  const row = await getSettings();
  const expr = cronExprFromTime(row.schedule_time || DEFAULT_TIME);
  if (!expr || !cron.validate(expr)) {
    console.warn(`[demo-reset] geçersiz saat "${row.schedule_time}"`);
    return;
  }
  scheduledTask = cron.schedule(
    expr,
    async () => {
      try {
        const result = await resetDemoTenant('scheduled');
        console.log(
          `[demo-reset] zamanlanmış geri alma bitti restored=${result.restored} added=${result.added.length}`
        );
      } catch (err) {
        console.error('[demo-reset] zamanlanmış geri alma başarısız:', err.message);
      }
    },
    { timezone: TIMEZONE }
  );
  console.log(`[demo-reset] her gün ${row.schedule_time || DEFAULT_TIME} (${TIMEZONE})`);
}

async function startDemoResetCron() {
  try {
    await ensureBaseline();
  } catch (err) {
    console.error('[demo-reset] başlangıç görüntüsü alınamadı:', err.message);
  }
  try {
    await rescheduleDemoCron();
  } catch (err) {
    console.error('[demo-reset] zamanlama kurulamadı:', err.message);
  }
}

module.exports = {
  DEMO_TENANT_NAME,
  findDemoTenant,
  getStatus,
  updateSchedule,
  resetDemoTenant,
  captureBaseline,
  startDemoResetCron,
};
