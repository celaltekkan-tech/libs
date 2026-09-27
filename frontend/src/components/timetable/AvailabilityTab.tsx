import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Col, Input, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import { listAvailability, listTimetableLessons, saveAvailability } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_LABELS, DAY_OPTIONS } from '../../types/scheduleEntry'
import type { AvailabilityCells, AvailabilityEntity, TimetableAvailability, TimetableLesson } from '../../types/timetable'
import { assignmentTeacherIds, shortClassroom, teacherFullName, type TimetableCtx } from './shared'

type Brush = 'closed' | 'avoid' | 'open'

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

// Bilsa renkleri: koyu gri okul dışı, açık gri kapalı, sarı istenmiyor, turuncu açık.
const COLORS = {
  outside: '#9ca3af',
  closed: '#e5e7eb',
  avoid: '#fde68a',
  open: '#fed7aa',
}

const ENTITY_LABELS: Record<AvailabilityEntity, string> = {
  school: 'Okul',
  teacher: 'Öğretmen',
  classroom: 'Sınıf',
  room: 'Mekan',
  subject: 'Ders',
}

interface EntityRow {
  id: number
  name: string
  extra?: string | null
}

export function AvailabilityTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const { project } = ctx
  const [rows, setRows] = useState<TimetableAvailability[]>([])
  const [lessons, setLessons] = useState<TimetableLesson[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<AvailabilityEntity>('teacher')
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [checked, setChecked] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [brush, setBrush] = useState<Brush>('closed')
  const [painting, setPainting] = useState<Set<string> | null>(null)
  const paintRef = useRef<Set<string> | null>(null)
  const [range, setRange] = useState({ d1: project.days[0] || 1, d2: project.days[project.days.length - 1] || 5, p1: 1, p2: project.periods_per_day })
  const editable = ctx.canUpdate
  const periods = Array.from({ length: project.periods_per_day }, (_, i) => i + 1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, l] = await Promise.all([listAvailability(project.id), listTimetableLessons(project.id)])
      setRows(a)
      setLessons(l)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const entities: EntityRow[] = useMemo(() => {
    if (type === 'teacher') return ctx.teachers.map((t) => ({ id: t.id, name: teacherFullName(t), extra: t.brans }))
    if (type === 'classroom') return ctx.classrooms.map((c) => ({ id: c.id, name: shortClassroom(c) }))
    if (type === 'room') return ctx.rooms.map((r) => ({ id: r.id, name: r.name, extra: `kapasite ${r.capacity}` }))
    if (type === 'subject') return ctx.subjects.map((s) => ({ id: s.id, name: s.name, extra: s.code }))
    return []
  }, [type, ctx.teachers, ctx.classrooms, ctx.rooms, ctx.subjects])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return entities.filter((e) => !q || `${e.name} ${e.extra || ''}`.toLocaleLowerCase('tr-TR').includes(q))
  }, [entities, search])

  useEffect(() => {
    setChecked([])
    setSearch('')
    setCurrentId(type === 'school' ? 0 : entities[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const cellsOf = useCallback(
    (t: AvailabilityEntity, id: number): AvailabilityCells =>
      rows.find((r) => r.entity_type === t && r.entity_id === id)?.cells || {},
    [rows],
  )
  const schoolCells = cellsOf('school', 0)
  const current = currentId == null ? {} : cellsOf(type, currentId)
  const closedCount = useCallback(
    (id: number) => Object.values(cellsOf(type, id)).filter((v) => v === 'closed').length,
    [cellsOf, type],
  )

  const targets = type === 'school' ? [0] : checked.length ? checked : currentId != null ? [currentId] : []

  const apply = async (cells: Record<string, Brush>) => {
    if (!targets.length || !Object.keys(cells).length) return
    try {
      const saved = await saveAvailability(project.id, { entity_type: type, entity_ids: targets, cells })
      setRows((prev) => {
        const rest = prev.filter((r) => !saved.some((s) => s.entity_type === r.entity_type && s.entity_id === r.entity_id))
        return [...rest, ...saved]
      })
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  // Sürükleyerek boyama: fare bırakılınca kaydedilir.
  useEffect(() => {
    const up = () => {
      const set = paintRef.current
      paintRef.current = null
      setPainting(null)
      if (set && set.size) void apply(Object.fromEntries([...set].map((k) => [k, brush])))
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  })

  const usable = (d: number, p: number) =>
    project.days.includes(d) && p <= project.periods_per_day && (type === 'school' || schoolCells[`${d}-${p}`] !== 'closed')

  const startPaint = (key: string) => {
    if (!editable) return
    const set = new Set([key])
    paintRef.current = set
    setPainting(set)
  }
  const extendPaint = (key: string) => {
    if (!paintRef.current) return
    paintRef.current.add(key)
    setPainting(new Set(paintRef.current))
  }

  const paintLine = (cells: Array<[number, number]>) => {
    const out: Record<string, Brush> = {}
    for (const [d, p] of cells) if (usable(d, p)) out[`${d}-${p}`] = brush
    void apply(out)
  }

  const applyRange = (state: Brush) => {
    const out: Record<string, Brush> = {}
    for (const d of project.days) {
      if (d < Math.min(range.d1, range.d2) || d > Math.max(range.d1, range.d2)) continue
      for (let p = Math.min(range.p1, range.p2); p <= Math.max(range.p1, range.p2); p++) {
        if (usable(d, p)) out[`${d}-${p}`] = state
      }
    }
    void apply(out)
  }

  // Taslak programda yerleşen dersler (bilgi amaçlı).
  const placed = useMemo(() => {
    const map = new Map<string, string[]>()
    if (currentId == null || type === 'school') return map
    for (const l of lessons) {
      const a = l.Assignment
      let hit = false
      let label = ''
      if (type === 'teacher' && assignmentTeacherIds(a).includes(currentId)) {
        hit = true
        label = `${shortClassroom(a.Classroom)} ${a.Subject?.code || a.Subject?.name || ''}`
      } else if (type === 'classroom' && a.classroom_id === currentId) {
        hit = true
        label = a.Subject?.code || a.Subject?.name || ''
      } else if (type === 'room' && (l.room_id ?? a.room_id) === currentId) {
        hit = true
        label = `${shortClassroom(a.Classroom)} ${a.Subject?.code || ''}`
      } else if (type === 'subject' && a.subject_id === currentId) {
        hit = true
        label = shortClassroom(a.Classroom)
      }
      if (!hit) continue
      const k = `${l.day_of_week}-${l.period_no}`
      map.set(k, [...(map.get(k) || []), label])
    }
    return map
  }, [lessons, currentId, type])

  const currentName = type === 'school' ? 'Okul geneli' : entities.find((e) => e.id === currentId)?.name || '—'
  const dayOptions = DAY_OPTIONS.filter((d) => project.days.includes(d.value))
  const periodOptions = periods.map((p) => ({ value: p, label: `${p}. saat` }))

  const cellColor = (d: number, p: number) => {
    if (!usable(d, p)) return COLORS.outside
    const key = `${d}-${p}`
    if (painting?.has(key)) return brush === 'open' ? COLORS.open : COLORS[brush]
    const state = current[key]
    return state ? COLORS[state] : COLORS.open
  }

  return (
    <>
      <Typography.Paragraph type="secondary">
        Koyu gri hücreler okul saati dışıdır (okul zaman tablosu veya ders günü değil). Açık gri hücrede ders
        konmaz, sarı hücreye mümkünse konmaz, turuncu hücreler açıktır. Fırçayı seçip hücrelere tıklayın ya da
        sürükleyin; gün adına veya saat numarasına tıklamak tüm sütunu/satırı boyar. Listede "Seç" ile birden fazla
        kayıt işaretlerseniz değişiklik hepsine uygulanır.
      </Typography.Paragraph>

      <Segmented<AvailabilityEntity>
        style={{ marginBottom: 12 }}
        value={type}
        onChange={setType}
        options={(Object.keys(ENTITY_LABELS) as AvailabilityEntity[]).map((k) => ({ value: k, label: ENTITY_LABELS[k] }))}
      />

      <Row gutter={12}>
        {type !== 'school' && (
          <Col xs={24} xl={8}>
            <Card size="small" styles={{ body: { padding: 8 } }}>
              <Input.Search allowClear placeholder="Ara" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
              <Table<EntityRow>
                rowKey="id"
                size="small"
                pagination={false}
                loading={loading}
                dataSource={filtered}
                scroll={{ y: 520 }}
                onRow={(e) => ({
                  onClick: () => setCurrentId(e.id),
                  style: { cursor: 'pointer', background: e.id === currentId ? '#e6f4ff' : undefined },
                })}
                columns={[
                  { title: 'Ad', dataIndex: 'name' },
                  { title: '', dataIndex: 'extra', width: 110, ellipsis: true },
                  {
                    title: 'Kapalı',
                    key: 'closed',
                    width: 60,
                    render: (_, e) => {
                      const n = closedCount(e.id)
                      return n ? <Tag>{n}</Tag> : null
                    },
                  },
                  {
                    title: (
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((e) => checked.includes(e.id))}
                        indeterminate={checked.length > 0 && !filtered.every((e) => checked.includes(e.id))}
                        onChange={(ev) => setChecked(ev.target.checked ? filtered.map((e) => e.id) : [])}
                      />
                    ),
                    key: 'sel',
                    width: 44,
                    render: (_, e) => (
                      <Checkbox
                        checked={checked.includes(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) =>
                          setChecked((prev) => (ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id)))
                        }
                      />
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        <Col xs={24} xl={type === 'school' ? 24 : 16}>
          <Card
            size="small"
            title={currentName}
            extra={
              editable && (
                <Space wrap>
                  <span>Fırça:</span>
                  <Segmented<Brush>
                    size="small"
                    value={brush}
                    onChange={setBrush}
                    options={[
                      { value: 'closed', label: 'Kapat' },
                      { value: 'avoid', label: 'İstenmiyor' },
                      { value: 'open', label: 'Aç' },
                    ]}
                  />
                </Space>
              )
            }
          >
            {type !== 'school' && checked.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 8 }}
                message={`Değişiklikler işaretli ${checked.length} kayda uygulanır (tabloda "${currentName}" gösteriliyor).`}
              />
            )}
            <div style={{ overflowX: 'auto', userSelect: 'none' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `44px repeat(${ALL_DAYS.length}, minmax(84px, 1fr))`,
                  gap: 2,
                  minWidth: 44 + ALL_DAYS.length * 86,
                }}
              >
                <div />
                {ALL_DAYS.map((d) => (
                  <div
                    key={d}
                    onClick={() => editable && paintLine(periods.map((p) => [d, p]))}
                    style={{ textAlign: 'center', fontWeight: 600, padding: 4, cursor: editable ? 'pointer' : 'default', background: '#f3f4f6' }}
                  >
                    {DAY_LABELS[d]}
                  </div>
                ))}
                {periods.map((p) => (
                  <Fragment key={p}>
                    <div
                      onClick={() => editable && paintLine(ALL_DAYS.map((d) => [d, p]))}
                      style={{ textAlign: 'center', fontWeight: 600, padding: 4, cursor: editable ? 'pointer' : 'default', background: '#f3f4f6' }}
                    >
                      {p}
                    </div>
                    {ALL_DAYS.map((d) => {
                      const key = `${d}-${p}`
                      const ok = usable(d, p)
                      const items = placed.get(key) || []
                      return (
                        <div
                          key={key}
                          onMouseDown={() => ok && startPaint(key)}
                          onMouseEnter={() => ok && extendPaint(key)}
                          style={{
                            minHeight: 38,
                            background: cellColor(d, p),
                            border: '1px solid #fff',
                            fontSize: 11,
                            lineHeight: 1.2,
                            textAlign: 'center',
                            padding: 2,
                            cursor: ok && editable ? 'crosshair' : 'default',
                          }}
                        >
                          {items.map((t, i) => (
                            <div key={i}>{t}</div>
                          ))}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            <Space wrap size={12} style={{ marginTop: 8, fontSize: 12 }}>
              {(['outside', 'closed', 'avoid', 'open'] as const).map((k) => (
                <Space key={k} size={4}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, background: COLORS[k], border: '1px solid #d1d5db' }} />
                  {{ outside: 'Okul saati dışı', closed: 'Kapalı', avoid: 'İstenmiyor', open: 'Açık' }[k]}
                </Space>
              ))}
            </Space>
          </Card>

          {editable && (
            <Card size="small" title="Gün ve saat aralığına uygula" style={{ marginTop: 12 }}>
              <Space wrap>
                <Select style={{ width: 130 }} value={range.d1} onChange={(v) => setRange((r) => ({ ...r, d1: v }))} options={dayOptions} />
                <span>—</span>
                <Select style={{ width: 130 }} value={range.d2} onChange={(v) => setRange((r) => ({ ...r, d2: v }))} options={dayOptions} />
                <Select style={{ width: 100 }} value={range.p1} onChange={(v) => setRange((r) => ({ ...r, p1: v }))} options={periodOptions} />
                <span>—</span>
                <Select style={{ width: 100 }} value={range.p2} onChange={(v) => setRange((r) => ({ ...r, p2: v }))} options={periodOptions} />
                <Button onClick={() => applyRange('closed')}>Kapat</Button>
                <Button onClick={() => applyRange('avoid')}>İstenmiyor</Button>
                <Button type="primary" onClick={() => applyRange('open')}>
                  Aç
                </Button>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </>
  )
}
