import type { ColumnsType, ColumnType, ColumnGroupType } from 'antd/es/table'

type Path = string | number | readonly (string | number)[]

function getByPath(record: unknown, path: Path): unknown {
  if (record == null) return undefined
  const parts = Array.isArray(path) ? path : [path]
  let current: unknown = record
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[part]
  }
  return current
}

/** Metin, sayı ve ISO tarih karşılaştırması (tr locale, A-Z / Z-A). */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null || a === '') return 1
  if (b == null || b === '') return -1

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0
    if (Number.isNaN(a)) return 1
    if (Number.isNaN(b)) return -1
    return a - b
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)

  if (Array.isArray(a) && Array.isArray(b)) {
    return compareValues(a.join(', '), b.join(', '))
  }

  const sa = String(a)
  const sb = String(b)
  if (/^\d{4}-\d{2}-\d{2}/.test(sa) && /^\d{4}-\d{2}-\d{2}/.test(sb)) {
    const da = Date.parse(sa)
    const db = Date.parse(sb)
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
  }

  return sa.localeCompare(sb, 'tr', { sensitivity: 'base', numeric: true })
}

const SKIP_TITLE =
  /işlem|aksiyon|action|seçim|seç\b|checkbox|avatar|foto|resim|qr/i

function titleText(title: ColumnType<unknown>['title']): string {
  if (typeof title === 'string' || typeof title === 'number') return String(title)
  return ''
}

function resolveSortPath<T>(col: ColumnType<T>): Path | null {
  if (col.dataIndex != null) return col.dataIndex as Path
  if (typeof col.key === 'string' && col.key && !col.key.startsWith('__')) {
    // key bazen path olarak kullanılır
    if (!['actions', 'action', 'işlemler', 'operations'].includes(col.key.toLowerCase())) {
      return col.key
    }
  }
  return null
}

function enhanceColumn<T extends object>(col: ColumnType<T> | ColumnGroupType<T>): ColumnType<T> | ColumnGroupType<T> {
  if ('children' in col && Array.isArray(col.children)) {
    return {
      ...col,
      children: col.children.map((child) => enhanceColumn(child)),
    }
  }

  const column = col as ColumnType<T>
  if (column.sorter !== undefined) return column
  if (SKIP_TITLE.test(titleText(column.title as ColumnType<unknown>['title']))) return column

  const path = resolveSortPath(column)
  if (path == null) return column

  return {
    ...column,
    sorter: (a: T, b: T) => compareValues(getByPath(a, path), getByPath(b, path)),
    sortDirections: ['ascend', 'descend'],
    showSorterTooltip: { title: 'A → Z / Z → A' },
  }
}

/** dataIndex (veya uygun key) olan sütunlara A-Z / Z-A sıralama ekler. */
export function withColumnSorters<T extends object>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((col) => enhanceColumn(col)) as ColumnsType<T>
}

/** Render-only sütunlar için: sortValue ile sıralama. */
export function sorterBy<T>(getValue: (record: T) => unknown): NonNullable<ColumnType<T>['sorter']> {
  return (a, b) => compareValues(getValue(a), getValue(b))
}

/** first_name + last_name birleşik ad sıralaması. */
export function personNameSorter<T extends { first_name?: string | null; last_name?: string | null }>() {
  return sorterBy<T>((r) => `${r.first_name || ''} ${r.last_name || ''}`.trim())
}

/** İç içe kişi nesnesi (Teacher, Student, …) için ad sıralaması. */
export function nestedPersonNameSorter<T>(
  getPerson: (record: T) => { first_name?: string | null; last_name?: string | null } | null | undefined,
) {
  return sorterBy<T>((r) => {
    const p = getPerson(r)
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : ''
  })
}

export const SORT_AZ = ['ascend', 'descend'] as const

