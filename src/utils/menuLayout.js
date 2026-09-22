'use strict';

/** @typedef {{ version: 1, order: string[], groups: Record<string, { label: string, children: string[] }>, hidden: string[] }} MenuLayout */

const HOME_KEY = '/';
const MAX_KEYS = 80;
const MAX_LABEL = 80;
const KEY_RE = /^(\/[\w\-./]*|grp-[\w-]+)$/;

/**
 * @param {unknown} raw
 * @returns {MenuLayout | null}
 */
function normalizeMenuLayout(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    const err = new Error('Geçersiz menü düzeni');
    err.status = 400;
    err.code = 'MENU_LAYOUT_INVALID';
    throw err;
  }

  const input = /** @type {Record<string, unknown>} */ (raw);
  if (input.version !== 1) {
    const err = new Error('Menü düzeni sürümü desteklenmiyor');
    err.status = 400;
    err.code = 'MENU_LAYOUT_INVALID';
    throw err;
  }

  const orderRaw = Array.isArray(input.order) ? input.order : [];
  const hiddenRaw = Array.isArray(input.hidden) ? input.hidden : [];
  const groupsRaw =
    input.groups && typeof input.groups === 'object' && !Array.isArray(input.groups)
      ? /** @type {Record<string, unknown>} */ (input.groups)
      : {};

  /** @type {string[]} */
  const order = [];
  for (const key of orderRaw) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) continue;
    if (!order.includes(key)) order.push(key);
    if (order.length >= MAX_KEYS) break;
  }

  if (!order.includes(HOME_KEY)) order.unshift(HOME_KEY);

  /** @type {Record<string, { label: string, children: string[] }>} */
  const groups = {};
  for (const [groupKey, value] of Object.entries(groupsRaw)) {
    if (!/^grp-[\w-]+$/.test(groupKey)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const g = /** @type {Record<string, unknown>} */ (value);
    const label = String(g.label || groupKey).trim().slice(0, MAX_LABEL) || groupKey;
    const childrenRaw = Array.isArray(g.children) ? g.children : [];
    /** @type {string[]} */
    const children = [];
    for (const child of childrenRaw) {
      if (typeof child !== 'string' || !child.startsWith('/') || child === HOME_KEY) continue;
      if (!KEY_RE.test(child)) continue;
      if (!children.includes(child)) children.push(child);
      if (children.length >= MAX_KEYS) break;
    }
    groups[groupKey] = { label, children };
  }

  /** @type {string[]} */
  const hidden = [];
  for (const key of hiddenRaw) {
    if (typeof key !== 'string' || key === HOME_KEY) continue;
    if (!key.startsWith('/') || !KEY_RE.test(key)) continue;
    if (!hidden.includes(key)) hidden.push(key);
    if (hidden.length >= MAX_KEYS) break;
  }

  return { version: 1, order, groups, hidden };
}

module.exports = {
  HOME_KEY,
  normalizeMenuLayout,
};
