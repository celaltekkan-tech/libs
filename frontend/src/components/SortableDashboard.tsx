import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Button, Checkbox, Col, Dropdown, Row, Space, Typography } from 'antd'
import { EyeInvisibleOutlined, HolderOutlined, SettingOutlined } from '@ant-design/icons'

export type DashboardWidgetSpan = {
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
}

export interface DashboardWidget {
  id: string
  /** Kartları yönet menüsünde görünen ad */
  label?: string
  span?: DashboardWidgetSpan
  node: ReactNode
}

type DropEdge = 'left' | 'right' | 'top' | 'bottom'

interface StoredLayout {
  order: string[]
  spans: Record<string, number>
  hidden: string[]
}

const STORAGE_PREFIX = 'okul-idare-dashboard-layout:'

/** 24’lük grid’de satırdaki kart sayısına göre eşit genişlik (1–6). */
function spanForCount(count: number): number {
  if (count <= 1) return 24
  if (count === 2) return 12
  if (count === 3) return 8
  if (count === 4) return 6
  if (count <= 6) return 4
  return 4
}

function isNarrowSpan(spans: Record<string, number>, id: string): boolean {
  const value = spans[id]
  return typeof value === 'number' && value > 0 && value < 24
}

function expandNarrowGroup(order: string[], spans: Record<string, number>, seedId: string): string[] {
  const idx = order.indexOf(seedId)
  if (idx < 0) return [seedId]
  let start = idx
  let end = idx
  while (start > 0 && isNarrowSpan(spans, order[start - 1])) start -= 1
  while (end < order.length - 1 && isNarrowSpan(spans, order[end + 1])) end += 1
  return order.slice(start, end + 1)
}

function reflowNarrowGroups(order: string[], spans: Record<string, number>): Record<string, number> {
  const next = { ...spans }
  let i = 0
  while (i < order.length) {
    if (!isNarrowSpan(next, order[i])) {
      i += 1
      continue
    }
    let j = i
    while (j < order.length && isNarrowSpan(next, order[j])) j += 1
    const group = order.slice(i, j)
    const each = spanForCount(group.length)
    for (const id of group) next[id] = each
    i = j
  }
  return next
}

function readStoredLayout(layoutKey: string): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + layoutKey)
    if (!raw) return { order: [], spans: {}, hidden: [] }
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return { order: parsed, spans: {}, hidden: [] }
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { order?: unknown; spans?: unknown; hidden?: unknown }
      const order = Array.isArray(record.order)
        ? record.order.filter((id): id is string => typeof id === 'string')
        : []
      const spans =
        record.spans && typeof record.spans === 'object' && !Array.isArray(record.spans)
          ? Object.fromEntries(
              Object.entries(record.spans as Record<string, unknown>).filter(
                (entry): entry is [string, number] => typeof entry[1] === 'number',
              ),
            )
          : {}
      const hidden = Array.isArray(record.hidden)
        ? record.hidden.filter((id): id is string => typeof id === 'string')
        : []
      return { order, spans, hidden }
    }
  } catch {
    /* ignore */
  }
  return { order: [], spans: {}, hidden: [] }
}

function writeStoredLayout(layoutKey: string, layout: StoredLayout) {
  try {
    localStorage.setItem(STORAGE_PREFIX + layoutKey, JSON.stringify(layout))
  } catch {
    /* ignore */
  }
}

function mergeOrder(saved: string[] | null | undefined, defaults: string[]): string[] {
  if (!saved || saved.length === 0) return defaults
  const defaultSet = new Set(defaults)
  const kept = saved.filter((id) => defaultSet.has(id))
  const missing = defaults.filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}

function mergeHidden(saved: string[] | null | undefined, defaults: string[]): string[] {
  if (!saved || saved.length === 0) return []
  const defaultSet = new Set(defaults)
  return saved.filter((id) => defaultSet.has(id))
}

function getDropEdge(event: DragEvent<HTMLDivElement>): DropEdge {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / Math.max(rect.width, 1)
  const y = (event.clientY - rect.top) / Math.max(rect.height, 1)
  if (x < 0.38) return 'left'
  if (x > 0.62) return 'right'
  if (y < 0.5) return 'top'
  return 'bottom'
}

function applyDrop(
  order: string[],
  spans: Record<string, number>,
  hidden: string[],
  fromId: string,
  toId: string,
  edge: DropEdge,
): StoredLayout {
  const nextOrder = [...order]
  const from = nextOrder.indexOf(fromId)
  if (from >= 0) nextOrder.splice(from, 1)
  const to = nextOrder.indexOf(toId)
  if (to < 0) return { order, spans, hidden }

  const nextSpansBase = { ...spans }
  let nextSpans = nextSpansBase
  const sideBySide = edge === 'left' || edge === 'right'
  const insertAt = edge === 'right' || edge === 'bottom' ? to + 1 : to
  nextOrder.splice(insertAt, 0, fromId)

  if (sideBySide) {
    // Aynı satıra ekle: bitişik dar kartlar 2–6 arası eşit paylaşılır.
    if (!isNarrowSpan(nextSpans, toId)) nextSpans[toId] = 12
    nextSpans[fromId] = 12
    const group = expandNarrowGroup(nextOrder, nextSpans, fromId)
    const each = spanForCount(group.length)
    for (const id of group) nextSpans[id] = each
  } else {
    // Üst/alta bırakınca tam genişlik; kalan satırlar yeniden dengelenir.
    nextSpans[fromId] = 24
    nextSpans = reflowNarrowGroups(nextOrder, nextSpans)
  }

  return { order: nextOrder, spans: nextSpans, hidden }
}

function resolveSpan(widget: DashboardWidget, override?: number): DashboardWidgetSpan {
  if (override) return { xs: 24, md: override }
  return widget.span ?? { xs: 24, sm: 12, lg: 8 }
}

function spansEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (left[key] !== right[key]) return false
  }
  return true
}

interface SortableDashboardProps {
  layoutKey: string
  widgets: DashboardWidget[]
}

export function SortableDashboard({ layoutKey, widgets }: SortableDashboardProps) {
  const defaultIds = widgets.map((widget) => widget.id)
  const widgetMap = new Map(widgets.map((widget) => [widget.id, widget]))

  const [order, setOrder] = useState<string[]>(() => mergeOrder(readStoredLayout(layoutKey).order, defaultIds))
  const [spans, setSpans] = useState<Record<string, number>>(() => readStoredLayout(layoutKey).spans)
  const [hidden, setHidden] = useState<string[]>(() =>
    mergeHidden(readStoredLayout(layoutKey).hidden, defaultIds),
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overEdge, setOverEdge] = useState<DropEdge | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const stored = readStoredLayout(layoutKey)
    setOrder(mergeOrder(stored.order, defaultIds))
    setSpans(stored.spans)
    setHidden(mergeHidden(stored.hidden, defaultIds))
    // defaultIds identity changes each render; layoutKey + widget id list is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, defaultIds.join('|')])

  const displayOrder = mergeOrder(order, defaultIds)
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])
  const visibleOrder = displayOrder.filter((id) => !hiddenSet.has(id))
  const isCustomized =
    displayOrder.join('|') !== defaultIds.join('|') || !spansEqual(spans, {}) || hidden.length > 0

  function persist(next: StoredLayout) {
    const merged = {
      order: mergeOrder(next.order, defaultIds),
      spans: next.spans,
      hidden: mergeHidden(next.hidden, defaultIds),
    }
    setOrder(merged.order)
    setSpans(merged.spans)
    setHidden(merged.hidden)
    writeStoredLayout(layoutKey, merged)
  }

  function clearDragState() {
    draggingIdRef.current = null
    setDraggingId(null)
    setOverId(null)
    setOverEdge(null)
  }

  function reset() {
    persist({ order: defaultIds, spans: {}, hidden: [] })
    clearDragState()
  }

  function hideWidget(id: string) {
    if (hiddenSet.has(id)) return
    persist({ order: displayOrder, spans, hidden: [...hidden, id] })
  }

  function setWidgetVisible(id: string, visible: boolean) {
    const nextHidden = visible ? hidden.filter((h) => h !== id) : hidden.includes(id) ? hidden : [...hidden, id]
    // En az bir kart görünsün
    if (!visible && nextHidden.length >= defaultIds.length) return
    persist({ order: displayOrder, spans, hidden: nextHidden })
  }

  function handleDragStart(id: string, event: DragEvent<HTMLButtonElement>) {
    draggingIdRef.current = id
    setDraggingId(id)
    setOverId(null)
    setOverEdge(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    const widgetEl = event.currentTarget.closest('.dashboard-widget')
    if (widgetEl instanceof HTMLElement) {
      event.dataTransfer.setDragImage(widgetEl, 24, 16)
    }
  }

  function handleDragOver(id: string, event: DragEvent<HTMLDivElement>) {
    const current = draggingIdRef.current
    if (!current || current === id) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const edge = getDropEdge(event)
    setOverId(id)
    setOverEdge(edge)
  }

  function handleDrop(id: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const current = draggingIdRef.current
    if (current && current !== id) {
      persist(applyDrop(displayOrder, spans, hidden, current, id, getDropEdge(event)))
      suppressClickRef.current = true
    }
    clearDragState()
  }

  function handleDragEnd() {
    clearDragState()
  }

  const manageMenu = {
    items: [
      {
        key: 'header',
        label: (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Gösterilecek kartlar
          </Typography.Text>
        ),
        disabled: true,
      },
      ...displayOrder.map((id) => {
        const widget = widgetMap.get(id)
        const label = widget?.label || id
        const checked = !hiddenSet.has(id)
        const onlyVisible = checked && visibleOrder.length === 1
        return {
          key: id,
          label: (
            <Checkbox
              checked={checked}
              disabled={onlyVisible}
              onChange={(e) => {
                e.stopPropagation()
                setWidgetVisible(id, e.target.checked)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {label}
            </Checkbox>
          ),
        }
      }),
    ],
  }

  return (
    <div>
      <div className="dashboard-layout-hint">
        <Typography.Text type="secondary">
          Tutamaktan sürükleyin. Kartı diğerinin sağına/soluna bırakarak aynı satıra ekleyin (2–6
          kart); üste/alta bırakarak tam genişlik yapın. Göz ile gizleyin.
        </Typography.Text>
        <Space size={4} wrap>
          <Dropdown menu={manageMenu} trigger={['click']} placement="bottomRight">
            <Button type="link" size="small" icon={<SettingOutlined />}>
              Kartları yönet{hidden.length > 0 ? ` (${hidden.length} gizli)` : ''}
            </Button>
          </Dropdown>
          {isCustomized && (
            <Button type="link" size="small" onClick={reset}>
              Düzeni sıfırla
            </Button>
          )}
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        {visibleOrder.map((id) => {
          const widget = widgetMap.get(id)
          if (!widget) return null
          const span = resolveSpan(widget, spans[widget.id])
          const isOver = overId === widget.id && draggingId !== widget.id
          return (
            <Col key={widget.id} {...span}>
              <div
                className={[
                  'dashboard-widget',
                  draggingId === widget.id ? 'is-dragging' : '',
                  isOver && overEdge ? `is-drop-${overEdge}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => handleDragOver(widget.id, event)}
                onDragEnter={(event) => handleDragOver(widget.id, event)}
                onDrop={(event) => handleDrop(widget.id, event)}
                onClickCapture={(event) => {
                  if (!suppressClickRef.current) return
                  event.preventDefault()
                  event.stopPropagation()
                  suppressClickRef.current = false
                }}
              >
                <button
                  type="button"
                  className="dashboard-drag-handle"
                  aria-label="Kartı taşı"
                  title="Sürükleyerek taşı"
                  draggable
                  onClick={(event) => event.stopPropagation()}
                  onDragStart={(event) => handleDragStart(widget.id, event)}
                  onDragEnd={handleDragEnd}
                >
                  <HolderOutlined />
                </button>
                <button
                  type="button"
                  className="dashboard-hide-btn"
                  aria-label="Kartı gizle"
                  title="Kartı gizle"
                  onClick={(event) => {
                    event.stopPropagation()
                    hideWidget(widget.id)
                  }}
                >
                  <EyeInvisibleOutlined />
                </button>
                {widget.node}
              </div>
            </Col>
          )
        })}
      </Row>
      {visibleOrder.length === 0 && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Tüm kartlar gizli. Üstteki “Kartları yönet” menüsünden tekrar gösterebilirsiniz.
        </Typography.Paragraph>
      )}
    </div>
  )
}
