import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Button, Col, Row, Typography } from 'antd'
import { HolderOutlined } from '@ant-design/icons'

export type DashboardWidgetSpan = {
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
}

export interface DashboardWidget {
  id: string
  span?: DashboardWidgetSpan
  node: ReactNode
}

type DropEdge = 'left' | 'right' | 'top' | 'bottom'

interface StoredLayout {
  order: string[]
  spans: Record<string, number>
}

const STORAGE_PREFIX = 'okul-idare-dashboard-layout:'
const SIDE_SPAN = 12

function readStoredLayout(layoutKey: string): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + layoutKey)
    if (!raw) return { order: [], spans: {} }
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return { order: parsed, spans: {} }
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { order?: unknown; spans?: unknown }
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
      return { order, spans }
    }
  } catch {
    /* ignore */
  }
  return { order: [], spans: {} }
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
  fromId: string,
  toId: string,
  edge: DropEdge,
): StoredLayout {
  const nextOrder = [...order]
  const from = nextOrder.indexOf(fromId)
  if (from >= 0) nextOrder.splice(from, 1)
  const to = nextOrder.indexOf(toId)
  if (to < 0) return { order, spans }

  const nextSpans = { ...spans }
  const sideBySide = edge === 'left' || edge === 'right'
  const insertAt = edge === 'right' || edge === 'bottom' ? to + 1 : to
  nextOrder.splice(insertAt, 0, fromId)

  if (sideBySide) {
    nextSpans[fromId] = SIDE_SPAN
    nextSpans[toId] = SIDE_SPAN
  }

  return { order: nextOrder, spans: nextSpans }
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overEdge, setOverEdge] = useState<DropEdge | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const stored = readStoredLayout(layoutKey)
    setOrder(mergeOrder(stored.order, defaultIds))
    setSpans(stored.spans)
  }, [layoutKey])

  const displayOrder = mergeOrder(order, defaultIds)
  const isCustomized =
    displayOrder.join('|') !== defaultIds.join('|') || !spansEqual(spans, {})

  function persist(next: StoredLayout) {
    const merged = { order: mergeOrder(next.order, defaultIds), spans: next.spans }
    setOrder(merged.order)
    setSpans(merged.spans)
    writeStoredLayout(layoutKey, merged)
  }

  function clearDragState() {
    draggingIdRef.current = null
    setDraggingId(null)
    setOverId(null)
    setOverEdge(null)
  }

  function reset() {
    persist({ order: defaultIds, spans: {} })
    clearDragState()
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
      persist(applyDrop(displayOrder, spans, current, id, getDropEdge(event)))
      suppressClickRef.current = true
    }
    clearDragState()
  }

  function handleDragEnd() {
    clearDragState()
  }

  return (
    <div>
      <div className="dashboard-layout-hint">
        <Typography.Text type="secondary">
          Tutamaktan sürükleyin. Yanına koymak için hedefin soluna veya sağına bırakın; üstüne/altına
          koymak için üst veya alt kenarına bırakın.
        </Typography.Text>
        {isCustomized && (
          <Button type="link" size="small" onClick={reset}>
            Düzeni sıfırla
          </Button>
        )}
      </div>
      <Row gutter={[16, 16]}>
        {displayOrder.map((id) => {
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
                {widget.node}
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
