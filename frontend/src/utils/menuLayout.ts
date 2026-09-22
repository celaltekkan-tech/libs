import {
  catalogFromNodes,
  groupIconFor,
  isNavGroup,
  type NavLeaf,
  type NavNode,
} from '../nav/tenantMenu'
import { MENU_HOME_KEY, type TenantMenuLayout } from '../types/menuLayout'

export function layoutFromNodes(nodes: NavNode[]): TenantMenuLayout {
  const { defaultGroups, defaultOrder } = catalogFromNodes(nodes)
  const groups: TenantMenuLayout['groups'] = {}
  for (const [key, value] of defaultGroups.entries()) {
    groups[key] = { label: value.label, children: [...value.children] }
  }
  return {
    version: 1,
    order: [...defaultOrder],
    groups,
    hidden: [],
  }
}

/**
 * Varsayılan menüyü tenant layout ile birleştirir.
 * Layout erişim vermez; yalnızca mevcut (izin/modül filtrelenmiş) öğeleri sıralar.
 */
export function applyMenuLayout(
  defaultNodes: NavNode[],
  layout: TenantMenuLayout | null | undefined,
): NavNode[] {
  if (!layout || layout.version !== 1) return defaultNodes

  const { leaves, defaultGroups, defaultOrder } = catalogFromNodes(defaultNodes)
  const hidden = new Set((layout.hidden || []).filter((k) => k !== MENU_HOME_KEY))
  const placed = new Set<string>()

  const home = leaves.get(MENU_HOME_KEY)
  const result: NavNode[] = []
  if (home) {
    result.push(home)
    placed.add(MENU_HOME_KEY)
  }

  const order = Array.isArray(layout.order) ? layout.order.filter((k) => k !== MENU_HOME_KEY) : []
  const layoutGroups = layout.groups || {}

  for (const key of order) {
    if (key.startsWith('grp-')) {
      const cfg = layoutGroups[key] || defaultGroups.get(key)
      if (!cfg) continue
      const children: NavLeaf[] = []
      for (const childKey of cfg.children || []) {
        if (hidden.has(childKey) || placed.has(childKey)) continue
        const leaf = leaves.get(childKey)
        if (!leaf || leaf.key === MENU_HOME_KEY) continue
        children.push(leaf)
        placed.add(childKey)
      }
      if (children.length === 0) continue
      result.push({
        key,
        icon: groupIconFor(key),
        label: cfg.label || key,
        children,
      })
      placed.add(key)
      continue
    }

    if (hidden.has(key) || placed.has(key)) continue
    const leaf = leaves.get(key)
    if (!leaf || leaf.key === MENU_HOME_KEY) continue
    result.push(leaf)
    placed.add(key)
  }

  // Layout'ta olmayan yeni öğeleri varsayılan sırayla ekle
  for (const key of defaultOrder) {
    if (key === MENU_HOME_KEY || hidden.has(key)) continue
    if (key.startsWith('grp-')) {
      const cfg = defaultGroups.get(key)
      if (!cfg) continue
      const children: NavLeaf[] = []
      for (const childKey of cfg.children) {
        if (hidden.has(childKey) || placed.has(childKey)) continue
        const leaf = leaves.get(childKey)
        if (!leaf) continue
        children.push(leaf)
        placed.add(childKey)
      }
      if (children.length === 0) continue
      const existingIdx = result.findIndex((n) => isNavGroup(n) && n.key === key)
      if (existingIdx >= 0) {
        const existing = result[existingIdx]
        if (isNavGroup(existing)) {
          result[existingIdx] = { ...existing, children: [...existing.children, ...children] }
        }
        continue
      }
      result.push({
        key,
        icon: groupIconFor(key),
        label: cfg.label,
        children,
      })
      placed.add(key)
      continue
    }
    if (placed.has(key)) continue
    const leaf = leaves.get(key)
    if (!leaf) continue
    result.push(leaf)
    placed.add(key)
  }

  // Hâlâ yerleştirilmemiş yapraklar (kenar durum)
  for (const [key, leaf] of leaves.entries()) {
    if (key === MENU_HOME_KEY || placed.has(key) || hidden.has(key)) continue
    result.push(leaf)
  }

  return result.filter((node) => {
    if (!isNavGroup(node)) return true
    return node.children.length > 0
  })
}

export function newCustomGroupKey(): string {
  return `grp-custom-${Date.now().toString(36)}`
}
