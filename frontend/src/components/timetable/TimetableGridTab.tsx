import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Empty, Popconfirm, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CloudUploadOutlined,
  LeftOutlined,
  LockFilled,
  LockOutlined,
  RightOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import {
  listTimetableLessons,
  lockTimetableLessons,
  moveTimetableLesson,
  publishTimetable,
  setTimetableLessonLock,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_LABELS } from '../../types/scheduleEntry'
import type { TimetableLesson } from '../../types/timetable'
import { shortClassroom, subjectBorder, subjectColor, teacherFullName, type TimetableCtx } from './shared'

type ViewMode = 'classroom' | 'teacher' | 'room'

export function TimetableGridTab({ ctx }: { ctx: TimetableCtx }) {
  const { message, modal } = App.useApp()
  const { project } = ctx
  const [lessons, setLessons] = useState<TimetableLesson[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ViewMode>('classroom')
  const [entityId, setEntityId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLessons(await listTimetableLessons(project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  // Görünüm seçenekleri: yalnızca taslakta geçen şube/öğretmen/mekanlar.
  const entities = useMemo(() => {
    const map = new Map<number, string>()
    for (const l of lessons) {
      const a = l.Assignment
      if (mode === 'classroom' && a.Classroom) map.set(a.classroom_id, shortClassroom(a.Classroom))
      if (mode === 'teacher' && a.teacher_id && a.Teacher) map.set(a.teacher_id, teacherFullName(a.Teacher))
      if (mode === 'room' && l.room_id) map.set(l.room_id, ctx.rooms.find((r) => r.id === l.room_id)?.name || `#${l.room_id}`)
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr', { numeric: true }))
  }, [lessons, mode, ctx.rooms])

  useEffect(() => {
    if (!entities.length) setEntityId(null)
    else if (!entities.some((e) => e.value === entityId)) setEntityId(entities[0].value)
  }, [entities, entityId])

  const visible = useMemo(
    () =>
      lessons.filter((l) => {
        if (!entityId) return false
        if (mode === 'classroom') return l.Assignment.classroom_id === entityId
        if (mode === 'teacher') return l.Assignment.teacher_id === entityId
        return l.room_id === entityId
      }),
    [lessons, mode, entityId],
  )

  // Elle taşımalardan doğan çakışmalar (senkron gruplar hariç).
  const clashIds = useMemo(() => {
    const ids = new Set<number>()
    const bySlot = new Map<string, TimetableLesson[]>()
    for (const l of lessons) {
      const k = `${l.day_of_week}:${l.period_no}`
      const list = bySlot.get(k) || []
      list.push(l)
      bySlot.set(k, list)
    }
    for (const list of bySlot.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i].Assignment
          const b = list[j].Assignment
          if (a.sync_group && a.sync_group === b.sync_group) continue
          if ((a.teacher_id && a.teacher_id === b.teacher_id) || a.classroom_id === b.classroom_id) {
            ids.add(list[i].id)
            ids.add(list[j].id)
          }
        }
      }
    }
    return ids
  }, [lessons])

  const doMove = async (lesson: TimetableLesson, day: number, period: number, force = false) => {
    try {
      const res = await moveTimetableLesson(lesson.id, day, period, force)
      if (!res.ok) {
        modal.confirm({
          title: 'Çakışma var',
          content: (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {res.conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ),
          okText: 'Yine de taşı',
          okButtonProps: { danger: true },
          cancelText: 'Vazgeç',
          onOk: () => doMove(lesson, day, period, true),
        })
        return
      }
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDrop = (day: number, period: number) => {
    setDropKey(null)
    const lesson = lessons.find((l) => l.id === dragId)
    setDragId(null)
    if (!lesson || (lesson.day_of_week === day && lesson.period_no === period)) return
    void doMove(lesson, day, period)
  }

  const toggleLock = async (l: TimetableLesson) => {
    try {
      await setTimetableLessonLock(l.id, !l.is_locked)
      setLessons((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_locked: !l.is_locked } : x)))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const lockView = async (locked: boolean) => {
    if (!entityId || mode === 'room') return
    try {
      const n = await lockTimetableLessons(project.id, {
        is_locked: locked,
        ...(mode === 'classroom' ? { classroom_id: entityId } : { teacher_id: entityId }),
      })
      message.success(`${n} ders ${locked ? 'kilitlendi' : 'kilidi açıldı'}`)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onPublish = async () => {
    setPublishing(true)
    try {
      const res = await publishTimetable(project.id)
      message.success(`${res.published} ders saati ders programına yazıldı (${res.classrooms} şube)`)
      if (res.teacher_dropped > 0) {
        message.warning(`${res.teacher_dropped} kayıtta aynı öğretmen aynı saatte iki şubede olduğundan öğretmen boş bırakıldı`)
      }
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  const step = (dir: 1 | -1) => {
    const idx = entities.findIndex((e) => e.value === entityId)
    const next = entities[(idx + dir + entities.length) % entities.length]
    if (next) setEntityId(next.value)
  }

  const periods = Array.from({ length: project.periods_per_day }, (_, i) => i + 1)
  const cellLessons = (d: number, p: number) => visible.filter((l) => l.day_of_week === d && l.period_no === p)
  const lockedCount = lessons.filter((l) => l.is_locked).length
  const editable = ctx.canUpdate

  // Görünen öğretmenin/şubenin günlük boşlukları (bilgi amaçlı).
  const gapCount = useMemo(() => {
    let gaps = 0
    for (const d of project.days) {
      const busy = periods.map((p) => visible.some((l) => l.day_of_week === d && l.period_no === p))
      const first = busy.indexOf(true)
      const last = busy.lastIndexOf(true)
      if (first < 0) continue
      for (let i = first; i <= last; i++) {
        if (!busy[i]) gaps += 1
      }
    }
    return gaps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, project.days, project.periods_per_day])

  if (!loading && lessons.length === 0) {
    return <Empty description='Henüz taslak program yok. "Oluştur" sekmesinden programı oluşturun.' />
  }

  const renderLesson = (l: TimetableLesson) => {
    const a = l.Assignment
    const detail =
      mode === 'classroom'
        ? teacherFullName(a.Teacher)
        : mode === 'teacher'
          ? shortClassroom(a.Classroom)
          : `${shortClassroom(a.Classroom)} · ${teacherFullName(a.Teacher)}`
    const clash = clashIds.has(l.id)
    return (
      <div
        key={l.id}
        draggable={editable}
        onDragStart={(e) => {
          setDragId(l.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => {
          setDragId(null)
          setDropKey(null)
        }}
        style={{
          background: subjectColor(a.subject_id),
          borderLeft: `4px solid ${clash ? '#ff4d4f' : subjectBorder(a.subject_id)}`,
          outline: clash ? '1px solid #ff4d4f' : undefined,
          borderRadius: 4,
          padding: '3px 6px',
          marginBottom: 2,
          cursor: editable ? 'grab' : 'default',
          opacity: dragId === l.id ? 0.4 : 1,
          position: 'relative',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 12, paddingRight: 16, lineHeight: 1.3 }}>{a.Subject?.name}</div>
        <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.3 }}>{detail}</div>
        {a.Room && mode !== 'room' && <div style={{ fontSize: 10, color: '#6b7280' }}>{a.Room.name}</div>}
        {editable ? (
          <Tooltip title={l.is_locked ? 'Kilitli: yeniden çözümde yerinde kalır' : 'Kilitle'}>
            <span
              onClick={() => toggleLock(l)}
              style={{ position: 'absolute', top: 2, right: 4, cursor: 'pointer', fontSize: 12, color: l.is_locked ? '#d4380d' : '#9ca3af' }}
            >
              {l.is_locked ? <LockFilled /> : <LockOutlined />}
            </span>
          </Tooltip>
        ) : (
          l.is_locked && <LockFilled style={{ position: 'absolute', top: 2, right: 4, fontSize: 12, color: '#d4380d' }} />
        )}
      </div>
    )
  }

  return (
    <>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Segmented<ViewMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'classroom', label: 'Şube' },
              { value: 'teacher', label: 'Öğretmen' },
              { value: 'room', label: 'Mekan' },
            ]}
          />
          <Button icon={<LeftOutlined />} onClick={() => step(-1)} disabled={entities.length < 2} />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 240 }}
            value={entityId ?? undefined}
            onChange={setEntityId}
            options={entities}
            loading={loading}
          />
          <Button icon={<RightOutlined />} onClick={() => step(1)} disabled={entities.length < 2} />
          {mode !== 'room' && <Tag>{visible.length} saat</Tag>}
          {mode === 'teacher' && <Tag color={gapCount ? 'orange' : 'green'}>{gapCount} boş saat</Tag>}
        </Space>
        <Space wrap>
          {editable && mode !== 'room' && (
            <>
              <Button icon={<LockOutlined />} onClick={() => lockView(true)}>
                Bu görünümü kilitle
              </Button>
              <Button icon={<UnlockOutlined />} onClick={() => lockView(false)}>
                Kilitleri aç
              </Button>
            </>
          )}
          {editable && (
            <Popconfirm
              title="Taslak ders programı yayınlansın mı?"
              description={
                <div style={{ maxWidth: 320 }}>
                  Bu okulun {project.academic_year || 'yılı belirtilmemiş'} ders programı kayıtları silinip bu taslakla
                  değiştirilecek. Ders programı sayfası, nöbet, sınav ve ek ders ekranları yeni programı kullanır.
                </div>
              }
              okText="Yayınla"
              cancelText="Vazgeç"
              onConfirm={onPublish}
            >
              <Button type="primary" icon={<CloudUploadOutlined />} loading={publishing}>
                Yayınla
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Space>

      {clashIds.size > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${clashIds.size} derste elle taşımadan kaynaklı çakışma var (kırmızı çerçeveli). Yayınlamadan önce düzeltin.`}
        />
      )}
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Dersleri sürükleyip bırakarak taşıyın. Aynı şubenin başka dersinin üstüne bırakırsanız iki ders yer değiştirir.
        Kilitli dersler ({lockedCount}) yeniden program oluşturulduğunda yerinde kalır.
      </Typography.Paragraph>

      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `48px repeat(${project.days.length}, minmax(130px, 1fr))`,
            gap: 4,
            minWidth: 48 + project.days.length * 134,
          }}
          aria-busy={loading}
        >
          <div />
          {project.days.map((d) => (
            <div key={d} style={{ fontWeight: 600, textAlign: 'center', padding: 6 }}>
              {DAY_LABELS[d]}
            </div>
          ))}
          {periods.map((p) => (
            <Fragment key={p}>
              {project.lunch_after && p === project.lunch_after + 1 && (
                <div
                  style={{
                    gridColumn: `1 / span ${project.days.length + 1}`,
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#9ca3af',
                    borderTop: '1px dashed #d1d5db',
                    paddingTop: 2,
                  }}
                >
                  öğle arası
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#6b7280' }}>
                {p}
              </div>
              {project.days.map((d) => {
                const key = `${d}:${p}`
                const items = cellLessons(d, p)
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      if (!editable || dragId == null) return
                      e.preventDefault()
                      if (dropKey !== key) setDropKey(key)
                    }}
                    onDragLeave={() => dropKey === key && setDropKey(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      onDrop(d, p)
                    }}
                    style={{
                      minHeight: 58,
                      border: `1px ${dropKey === key ? 'dashed #1677ff' : 'solid #e5e7eb'}`,
                      background: dropKey === key ? '#e6f4ff' : '#fff',
                      borderRadius: 6,
                      padding: 3,
                    }}
                  >
                    {items.map(renderLesson)}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </>
  )
}
