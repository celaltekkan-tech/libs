'use strict';

/**
 * Genişletilebilir kurum takvimi.
 *
 * Yeni kaynak eklemek için:
 *   1. providers/ altında provider oluştur (id, label, permission, listEvents)
 *   2. registerProvider(provider) çağır
 *
 * Örnek (ileride): examsProvider → exam_date aralığı, exams.read
 */

const workTasksProvider = require('./providers/workTasksProvider');

/** @type {Map<string, { id: string, label: string, permission: string, listEvents: Function }>} */
const providers = new Map();

function registerProvider(provider) {
  if (!provider?.id || typeof provider.listEvents !== 'function') {
    throw new Error('Geçersiz takvim provider');
  }
  providers.set(provider.id, provider);
}

function listProviders() {
  return Array.from(providers.values());
}

function hasPermission(access, permissionKey) {
  if (!access) return false;
  if (access.is_global_admin) return true;
  return Array.isArray(access.permissions) && access.permissions.includes(permissionKey);
}

function parseDateBoundary(value, endOfDay) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  // Europe/Istanbul sabit ofset (+03:00); takvim gün sınırları için yeterli.
  if (endOfDay) return new Date(`${raw}T23:59:59.999+03:00`);
  return new Date(`${raw}T00:00:00.000+03:00`);
}

function resolveSources(requestedSources, access) {
  const all = listProviders();
  const allowed = all.filter((p) => hasPermission(access, p.permission));
  if (!requestedSources || requestedSources.length === 0) {
    return allowed;
  }
  const wanted = new Set(requestedSources);
  return allowed.filter((p) => wanted.has(p.id));
}

/**
 * @returns {{ id: string, label: string, available: boolean }[]}
 */
function listSourcesForAccess(access) {
  return listProviders().map((p) => ({
    id: p.id,
    label: p.label,
    available: hasPermission(access, p.permission),
  }));
}

/**
 * @param {{ tenantId: number, from: string, to: string, sources?: string[], access: object }} opts
 */
async function listEvents({ tenantId, from, to, sources, access }) {
  const fromDate = parseDateBoundary(from, false);
  const toDate = parseDateBoundary(to, true);
  if (!fromDate || !toDate || fromDate > toDate) {
    const err = new Error('Geçerli from/to tarihleri gerekli (YYYY-MM-DD)');
    err.status = 400;
    err.code = 'CALENDAR_RANGE_INVALID';
    throw err;
  }

  const activeProviders = resolveSources(sources, access);
  const batches = await Promise.all(
    activeProviders.map((p) =>
      p.listEvents({ tenantId, userId: access?.user?.id, from: fromDate, to: toDate, access }),
    ),
  );

  const events = batches.flat();
  events.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  return events;
}

registerProvider(workTasksProvider);

module.exports = {
  registerProvider,
  listProviders,
  listSourcesForAccess,
  listEvents,
  parseDateBoundary,
};
