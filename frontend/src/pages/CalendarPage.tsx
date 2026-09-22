import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  App,
  Button,
  Calendar,
  Checkbox,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { CalendarProps } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { getErrorMessage } from '../api/client'
import { listCalendarEvents, listCalendarSources } from '../api/calendar'
import {
  CALENDAR_COLOR_STYLES,
  CALENDAR_SOURCE_LABELS,
  type CalendarEvent,
  type CalendarSource,
} from '../types/calendarEvent'

const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const DUE_STATE_LABELS: Record<string, string> = {
  overdue: 'Gecikmiş',
  due_soon: 'Yaklaşıyor',
  upcoming: 'Yaklaşan',
  done_period: 'Bu dönem yapıldı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}

function eventStyle(colorKey: string) {
  return CALENDAR_COLOR_STYLES[colorKey] || CALENDAR_COLOR_STYLES.work_tasks
}

function dayKeyFromIso(iso: string) {
  // Europe/Istanbul takvim günü (UTC kayması olmasın)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return dayjs(iso).format('YYYY-MM-DD')
  }
}

export function CalendarPage() {
  const { message } = App.useApp()
  const [panelDate, setPanelDate] = useState<Dayjs>(() => dayjs())
  const [sources, setSources] = useState<CalendarSource[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const availableSources = useMemo(() => sources.filter((s) => s.available), [sources])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listCalendarSources()
        if (cancelled) return
        setSources(list)
        setSelectedSources(list.filter((s) => s.available).map((s) => s.id))
      } catch (err) {
        message.error(getErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [message])

  const loadEvents = useCallback(async () => {
    if (selectedSources.length === 0) {
      setEvents([])
      return
    }
    const from = panelDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD')
    const to = panelDate.endOf('month').add(7, 'day').format('YYYY-MM-DD')
    setLoading(true)
    try {
      const data = await listCalendarEvents({ from, to, sources: selectedSources })
      setEvents(data)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [panelDate, selectedSources, message])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const key = dayKeyFromIso(ev.start_at)
      const list = map.get(key) || []
      list.push(ev)
      map.set(key, list)
    }
    return map
  }, [events])

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : []

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const key = current.format('YYYY-MM-DD')
    const dayEvents = eventsByDay.get(key) || []
    const shown = dayEvents.slice(0, 3)
    const more = dayEvents.length - shown.length
    return (
      <div style={{ minHeight: 56, padding: '2px 2px 0', overflow: 'hidden' }}>
        {shown.map((ev) => {
          const style = eventStyle(ev.color_key)
          return (
            <div
              key={ev.id}
              title={ev.title}
              style={{
                fontSize: 11,
                lineHeight: 1.25,
                marginBottom: 2,
                padding: '1px 4px',
                borderRadius: 4,
                background: style.bg,
                color: style.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ev.title}
            </div>
          )
        })}
        {more > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            +{more} daha
          </Typography.Text>
        )}
      </div>
    )
  }

  return (
    <AppLayout title="Kurum Takvimi">
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        İş takibi vadeleri ve ileride eklenecek diğer programlar (ör. sınav) bu takvimde toplanır.
      </Typography.Paragraph>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Space wrap>
          {availableSources.length === 0 ? (
            <Typography.Text type="secondary">Görüntülenecek kaynak yok.</Typography.Text>
          ) : (
            <Checkbox.Group
              options={availableSources.map((s) => ({
                label: s.label,
                value: s.id,
              }))}
              value={selectedSources}
              onChange={(vals) => setSelectedSources(vals as string[])}
            />
          )}
        </Space>
        {loading && <Typography.Text type="secondary">Yükleniyor...</Typography.Text>}
      </Space>

      <Calendar
        value={panelDate}
        onPanelChange={(date) => setPanelDate(date)}
        onSelect={(date, info) => {
          setPanelDate(date)
          // Ay/yıl değişiminde modal açma; yalnızca gün tıklanınca
          if (info?.source === 'date') {
            setSelectedDay(date.format('YYYY-MM-DD'))
          }
        }}
        cellRender={cellRender}
        headerRender={({ value, onChange }) => (
          <Space style={{ padding: 8 }}>
            <Select
              value={value.month()}
              onChange={(m) => {
                setSelectedDay(null)
                onChange(value.month(m))
              }}
              options={MONTH_NAMES.map((name, idx) => ({ value: idx, label: name }))}
              style={{ width: 120 }}
            />
            <InputNumber
              value={value.year()}
              onChange={(y) => {
                if (!y) return
                setSelectedDay(null)
                onChange(value.year(Number(y)))
              }}
              style={{ width: 90 }}
            />
          </Space>
        )}
      />

      <Modal
        title={selectedDay ? `${dayjs(selectedDay).format('DD.MM.YYYY')} — Olaylar` : ''}
        open={!!selectedDay}
        onCancel={() => setSelectedDay(null)}
        footer={<Button onClick={() => setSelectedDay(null)}>Kapat</Button>}
        width={560}
      >
        {selectedDayEvents.length === 0 ? (
          <Typography.Text type="secondary">Bu günde kayıt yok.</Typography.Text>
        ) : (
          <List
            dataSource={selectedDayEvents}
            renderItem={(ev) => {
              const style = eventStyle(ev.color_key)
              const sourceLabel =
                CALENDAR_SOURCE_LABELS[ev.source] ||
                sources.find((s) => s.id === ev.source)?.label ||
                ev.source
              return (
                <List.Item
                  actions={
                    ev.href
                      ? [
                          <Link key="go" to={ev.href} onClick={() => setSelectedDay(null)}>
                            Git
                          </Link>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <span>{ev.title}</span>
                        <Tag color={style.tag}>{sourceLabel}</Tag>
                        {ev.meta?.due_state && (
                          <Tag>{DUE_STATE_LABELS[String(ev.meta.due_state)] || String(ev.meta.due_state)}</Tag>
                        )}
                        {ev.meta?.is_mandatory && <Tag color="red">Zorunlu</Tag>}
                        {ev.meta?.status === 'paused' && <Tag>Duraklatıldı</Tag>}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Typography.Text type="secondary">
                          {dayjs(ev.start_at).format('DD.MM.YYYY HH:mm')}
                          {ev.meta?.assignee_name ? ` · ${ev.meta.assignee_name}` : ''}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
          />
        )}
      </Modal>
    </AppLayout>
  )
}
