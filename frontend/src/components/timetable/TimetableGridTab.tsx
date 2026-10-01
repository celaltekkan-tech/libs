import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Dropdown, Empty, Popconfirm, Segmented, Select, Space, Tag, Tooltip, Typography, theme } from 'antd'
import {
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownOutlined,
  ChromeOutlined,
  FileExcelOutlined,
  LeftOutlined,
  LockFilled,
  LockOutlined,
  RightOutlined,
  UnlockOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  clearPublishedSchedule,
  clearTimetableLessons,
  exportTimetableLessons,
  fetchEokulPayload,
  listAvailability,
  listTimetableLessons,
  lockTimetableLessons,
  moveTimetableLesson,
  publishTimetable,
  setTimetableLessonLock,
  type TimetableExportView,
} from '../../api/timetable'
import { TypedPhraseConfirmModal } from '../TypedPhraseConfirmModal'
import { ProgramImportModal } from './ProgramImportModal'
import { downloadBlob } from '../../utils/download'
import { getErrorMessage } from '../../api/client'
import { DAY_LABELS } from '../../types/scheduleEntry'
import { periodClock } from './bell'
import type { TimetableAvailability, TimetableLesson } from '../../types/timetable'
import {
  assignmentTeacherIds,
  shortClassroom,
  subjectBorder,
  subjectColor,
  teacherFullName,
  type TimetableCtx,
} from './shared'

type ViewMode = 'classroom' | 'teacher' | 'room'
type WipeScope = 'draft-all' | 'published-all'

export function TimetableGridTab({ ctx }: { ctx: TimetableCtx }) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const dark = token.colorBgBase.toLowerCase() === '#000' || token.colorBgBase.toLowerCase() === '#000000'
  const { project } = ctx
  const [lessons, setLessons] = useState<TimetableLesson[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ViewMode>('classroom')
  const [entityId, setEntityId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [eokulExporting, setEokulExporting] = useState(false)
  const [availability, setAvailability] = useState<TimetableAvailability[]>([])
  const [wipe, setWipe] = useState<WipeScope | null>(null)
  const [wiping, setWiping] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, avail] = await Promise.all([listTimetableLessons(project.id), listAvailability(project.id)])
      setLessons(rows)
      setAvailability(avail)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const teacherById = useMemo(() => new Map(ctx.teachers.map((t) => [t.id, t])), [ctx.teachers])
  const teacherNames = useCallback(
    (a: TimetableLesson['Assignment']) =>
      assignmentTeacherIds(a)
        .map((id) => (id === a.teacher_id && a.Teacher ? teacherFullName(a.Teacher) : teacherFullName(teacherById.get(id))))
        .join(', ') || '—',
    [teacherById],
  )

  // Görünüm seçenekleri: yalnızca taslakta geçen şube/öğretmen/mekanlar.
  const entities = useMemo(() => {
    const map = new Map<number, string>()
    for (const l of lessons) {
      const a = l.Assignment
      if (mode === 'classroom' && a.Classroom) map.set(a.classroom_id, shortClassroom(a.Classroom))
      if (mode === 'teacher') {
        for (const id of assignmentTeacherIds(a)) {
          const name = id === a.teacher_id && a.Teacher ? teacherFullName(a.Teacher) : teacherFullName(teacherById.get(id))
          map.set(id, name)
        }
      }
      if (mode === 'room' && l.room_id) map.set(l.room_id, ctx.rooms.find((r) => r.id === l.room_id)?.name || `#${l.room_id}`)
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr', { numeric: true }))
  }, [lessons, mode, ctx.rooms, teacherById])

  // Taslak boşken de şube/öğretmen seçilebilsin; yayındaki program kısmen silinebilsin.
  const pickerOptions = useMemo(() => {
    if (entities.length) return entities
    if (mode === 'classroom') {
      return ctx.classrooms
        .map((c) => ({ value: c.id, label: shortClassroom(c) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr', { numeric: true }))
    }
    if (mode === 'teacher') {
      return ctx.teachers
        .map((t) => ({ value: t.id, label: teacherFullName(t) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
    }
    return ctx.rooms
      .filter((r) => r.is_active)
      .map((r) => ({ value: r.id, label: r.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
  }, [entities, mode, ctx.classrooms, ctx.teachers, ctx.rooms])

  useEffect(() => {
    if (!pickerOptions.length) setEntityId(null)
    else if (!pickerOptions.some((e) => e.value === entityId)) setEntityId(pickerOptions[0].value)
  }, [pickerOptions, entityId])

  const visible = useMemo(
    () =>
      lessons.filter((l) => {
        if (!entityId) return false
        if (mode === 'classroom') return l.Assignment.classroom_id === entityId
        if (mode === 'teacher') return assignmentTeacherIds(l.Assignment).includes(entityId)
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
          const bt = assignmentTeacherIds(b)
          // Aynı seçmeli grubundaki dersler aynı şubede paralel olabilir.
          const parallel = Boolean(a.elective_group && a.elective_group === b.elective_group)
          if (assignmentTeacherIds(a).some((id) => bt.includes(id)) || (a.classroom_id === b.classroom_id && !parallel)) {
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

  const onEokulFile = async () => {
    setEokulExporting(true)
    try {
      const payload = await fetchEokulPayload(project.id)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      downloadBlob(blob, 'eokul-ders-programi.json')
      message.success('e-Okul dosyası indirildi. Chrome eklentisi bu dosyayı okur.')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setEokulExporting(false)
    }
  }

  const onExport = async (key: string) => {
    const current = key === 'current'
    const view = (current ? mode : key) as TimetableExportView
    if (current && !entityId) return
    const names: Record<TimetableExportView, [string, string]> = {
      classroom: ['ders-programi-sube', 'ders-programi-subeler'],
      teacher: ['ders-programi-ogretmen', 'ders-programi-ogretmenler'],
      student: ['ders-programi-ogrenci', 'ders-programi-ogrenciler'],
      room: ['ders-programi-mekan', 'ders-programi-mekanlar'],
    }
    setExporting(true)
    try {
      const blob = await exportTimetableLessons(project.id, {
        view,
        ...(current && entityId ? { entity_id: entityId } : {}),
      })
      downloadBlob(blob, `${names[view][current ? 0 : 1]}.xlsx`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const step = (dir: 1 | -1) => {
    const idx = pickerOptions.findIndex((e) => e.value === entityId)
    const next = pickerOptions[(idx + dir + pickerOptions.length) % pickerOptions.length]
    if (next) setEntityId(next.value)
  }

  const viewLabel = pickerOptions.find((e) => e.value === entityId)?.label || ''
  const viewNoun = mode === 'classroom' ? 'şubenin' : mode === 'teacher' ? 'öğretmenin' : 'mekanın'

  const afterClear = async (text: string) => {
    message.success(text)
    await load()
    await ctx.reloadProject()
  }

  const clearDraft = async (filter: Parameters<typeof clearTimetableLessons>[1], done: string): Promise<boolean> => {
    try {
      const deleted = await clearTimetableLessons(project.id, filter)
      if (!deleted) {
        message.info('Silinecek taslak ders bulunamadı')
        return true
      }
      await afterClear(done.replace('{n}', String(deleted)))
      return true
    } catch (err) {
      message.error(getErrorMessage(err))
      return false
    }
  }

  const clearPublished = async (
    filter: { classroom_id?: number; teacher_id?: number },
    label: string,
  ): Promise<boolean> => {
    try {
      const res = await clearPublishedSchedule(project.id, filter)
      if (!res.deleted && !res.updated) {
        message.info('Silinecek yayındaki ders bulunamadı')
        return true
      }
      const bits: string[] = []
      if (res.deleted) bits.push(`${res.deleted} ders saati silindi`)
      if (res.updated) bits.push(`${res.updated} ortak derste öğretmen güncellendi`)
      await afterClear(label ? `${label}: ${bits.join(', ')}` : bits.join(', '))
      return true
    } catch (err) {
      message.error(getErrorMessage(err))
      return false
    }
  }

  const removeLesson = (lesson: TimetableLesson) => {
    const name = lesson.Assignment.Subject?.name || 'Ders'
    modal.confirm({
      title: `${name} silinsin mi?`,
      content: 'Yalnızca bu saatteki taslak yerleştirme silinir. Ders ataması ve yayındaki program durur.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: () => clearDraft({ ids: [lesson.id] }, `${name} taslaktan silindi`),
    })
  }

  const confirmPartial = (title: string, content: string, onOk: () => Promise<unknown>) => {
    modal.confirm({
      title,
      content,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk,
    })
  }

  const onWipe = async () => {
    if (!wipe) return
    setWiping(true)
    try {
      const ok =
        wipe === 'draft-all'
          ? await clearDraft({}, 'Taslaktaki {n} ders saati silindi')
          : await clearPublished({}, 'Yayındaki program')
      if (ok) setWipe(null)
    } finally {
      setWiping(false)
    }
  }

  const deleteMenu = ctx.canDelete ? (
    <Dropdown
      menu={{
        items: [
          {
            key: 'view-draft',
            label: `Bu ${viewNoun} taslağını sil`,
            disabled: !entityId || lessons.length === 0,
          },
          { key: 'draft-all', label: 'Tüm taslak programı sil', disabled: lessons.length === 0 },
          { type: 'divider' },
          {
            key: 'view-published',
            label:
              mode === 'room'
                ? 'Yayın mekan bazında silinemez'
                : mode === 'teacher'
                  ? 'Bu öğretmenin yayındaki programını sil'
                  : 'Bu şubenin yayındaki programını sil',
            disabled: mode === 'room' || !entityId,
          },
          { key: 'published-all', label: 'Bu okulun yayındaki tüm programını sil', danger: true },
        ],
        onClick: ({ key }) => {
          if (key === 'view-draft' && entityId) {
            const filter =
              mode === 'classroom'
                ? { classroom_id: entityId }
                : mode === 'teacher'
                  ? { teacher_id: entityId }
                  : { room_id: entityId }
            confirmPartial(
              `${viewLabel || 'Görünen program'} taslağı silinsin mi?`,
              'Yalnızca bu görünümdeki yerleştirilen dersler silinir. Ders atamaları ve yayındaki program durur.',
              () => clearDraft(filter, `${viewLabel} taslağından {n} saat silindi`),
            )
          } else if (key === 'draft-all') {
            setWipe('draft-all')
          } else if (key === 'view-published' && entityId && mode !== 'room') {
            const filter = mode === 'classroom' ? { classroom_id: entityId } : { teacher_id: entityId }
            confirmPartial(
              `${viewLabel || 'Görünen kayıt'} yayındaki programı silinsin mi?`,
              mode === 'teacher'
                ? 'Bu öğretmenin bu okuldaki yayındaki dersleri kalkar. Ortak girilen derste kayıt durur, öğretmen listeden çıkar. Nöbet, sınav ve ek ders bu programa bakar.'
                : 'Bu şubenin yayındaki ders programı tamamen kalkar. Taslak ve ders atamaları durur. Nöbet, sınav ve ek ders bu programa bakar.',
              () => clearPublished(filter, `${viewLabel} yayındaki programı`),
            )
          } else if (key === 'published-all') {
            setWipe('published-all')
          }
        },
      }}
    >
      <Button danger icon={<DeleteOutlined />}>
        Sil <DownOutlined />
      </Button>
    </Dropdown>
  ) : null

  const wipeModal = (
    <TypedPhraseConfirmModal
      open={wipe != null}
      loading={wiping}
      title={wipe === 'published-all' ? 'Yayındaki ders programı silinsin mi?' : 'Taslak ders programının tamamı silinsin mi?'}
      description={
        wipe === 'published-all'
          ? `Bu okulun ${project.academic_year || 'yılı belirtilmemiş'} yayındaki ders programı kayıtlarının tamamı silinir. Çalışma taslağa döner. Ders atamaları ve taslak yerleştirme durur. Nöbet, sınav ve ek ders ekranları boş program görür.`
          : 'Bu çalışmadaki yerleştirilen derslerin tamamı silinir. Ders atamaları, istekler ve yayındaki program durur. Programı yeniden oluşturabilirsiniz.'
      }
      okText="Sil"
      onCancel={() => {
        if (!wiping) setWipe(null)
      }}
      onConfirm={onWipe}
    />
  )

  const periods = Array.from({ length: project.periods_per_day }, (_, i) => i + 1)

  // Zaman tablosunda kapalı / istenmiyor hücreler (okul + görünen kayıt).
  const cellState = useMemo(() => {
    const out: Record<string, 'closed' | 'avoid'> = {}
    const entityType = mode === 'teacher' ? 'teacher' : mode === 'classroom' ? 'classroom' : 'room'
    for (const row of availability) {
      const match = row.entity_type === 'school' || (row.entity_type === entityType && row.entity_id === entityId)
      if (!match) continue
      for (const [k, v] of Object.entries(row.cells)) {
        if (out[k] !== 'closed') out[k] = v
      }
    }
    return out
  }, [availability, mode, entityId])
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

  const importModal = (
    <ProgramImportModal
      projectId={project.id}
      open={importOpen}
      subjects={ctx.subjects}
      teachers={ctx.teachers}
      classrooms={ctx.classrooms}
      onClose={() => setImportOpen(false)}
      onImported={() => {
        setImportOpen(false)
        void load()
        void ctx.reloadProject()
      }}
    />
  )

  const renderLesson = (l: TimetableLesson) => {
    const a = l.Assignment
    const detail =
      mode === 'classroom'
        ? teacherNames(a)
        : mode === 'teacher'
          ? shortClassroom(a.Classroom)
          : `${shortClassroom(a.Classroom)} · ${teacherNames(a)}`
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
          background: subjectColor(a.subject_id, dark),
          borderLeft: `4px solid ${clash ? token.colorError : subjectBorder(a.subject_id, dark)}`,
          outline: clash ? '1px solid #ff4d4f' : undefined,
          borderRadius: 4,
          padding: '3px 6px',
          marginBottom: 2,
          cursor: editable ? 'grab' : 'default',
          opacity: dragId === l.id ? 0.4 : 1,
          position: 'relative',
        }}
      >
        {ctx.canDelete && (
          <Tooltip title="Bu dersi sil">
            <span
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={() => removeLesson(l)}
              style={{ position: 'absolute', top: 2, left: 6, cursor: 'pointer', fontSize: 11, color: '#9ca3af' }}
            >
              <CloseOutlined />
            </span>
          </Tooltip>
        )}
        <div
          style={{
            fontWeight: 600,
            fontSize: 12,
            paddingRight: 16,
            paddingLeft: ctx.canDelete ? 12 : 0,
            lineHeight: 1.3,
            color: token.colorText,
          }}
        >
          {a.Subject?.name}
        </div>
        <div style={{ fontSize: 11, color: token.colorTextSecondary, lineHeight: 1.3 }}>{detail}</div>
        {a.Room && mode !== 'room' && <div style={{ fontSize: 10, color: token.colorTextSecondary }}>{a.Room.name}</div>}
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
          <Button icon={<LeftOutlined />} onClick={() => step(-1)} disabled={pickerOptions.length < 2} />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 240 }}
            value={entityId ?? undefined}
            onChange={setEntityId}
            options={pickerOptions}
            loading={loading}
          />
          <Button icon={<RightOutlined />} onClick={() => step(1)} disabled={pickerOptions.length < 2} />
          {mode !== 'room' && <Tag>{visible.length} saat</Tag>}
          {mode === 'teacher' && <Tag color={gapCount ? 'orange' : 'green'}>{gapCount} boş saat</Tag>}
        </Space>
        <Space wrap>
          {ctx.canCreate && (
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              İçe aktar
            </Button>
          )}
          <Tooltip title="Chrome eklentisinin e-Okul ders programı ekranına işleyeceği dosya">
            <Button
              icon={<ChromeOutlined />}
              loading={eokulExporting}
              disabled={lessons.length === 0}
              onClick={() => void onEokulFile()}
            >
              e-Okul
            </Button>
          </Tooltip>
          <Dropdown
            disabled={exporting || lessons.length === 0}
            menu={{
              items: [
                {
                  key: 'current',
                  label:
                    mode === 'classroom'
                      ? 'Bu şubenin programı'
                      : mode === 'teacher'
                        ? 'Bu öğretmenin programı'
                        : 'Bu mekanın programı',
                  disabled: !entityId,
                },
                { type: 'divider' },
                { key: 'classroom', label: 'Tüm şubeler' },
                { key: 'teacher', label: 'Tüm öğretmenler' },
                { key: 'student', label: 'Tüm öğrenciler' },
                { key: 'room', label: 'Tüm mekanlar' },
              ],
              onClick: ({ key }) => void onExport(key),
            }}
          >
            <Button icon={<FileExcelOutlined />} loading={exporting}>
              Excel <DownOutlined />
            </Button>
          </Dropdown>
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
          {deleteMenu}
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

      {!loading && lessons.length === 0 && (
        <Empty
          style={{ marginBottom: 12 }}
          description="Henüz taslak program yok. Oluştur sekmesinden üretebilir, hazır programı içe aktarabilir veya yayındaki programı silebilirsiniz."
        />
      )}
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
        Karttaki çarpı tek dersi siler. Sil menüsü görünen şubeyi, öğretmeni, mekanı ya da programın tamamını kaldırır.
        Kilitli dersler ({lockedCount}) yeniden program oluşturulduğunda yerinde kalır.
      </Typography.Paragraph>

      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `64px repeat(${project.days.length}, minmax(130px, 1fr))`,
            gap: 4,
            minWidth: 64 + project.days.length * 134,
          }}
          aria-busy={loading}
        >
          <div />
          {project.days.map((d) => (
            <div
              key={d}
              style={{
                fontWeight: 700,
                fontSize: 13,
                textAlign: 'center',
                padding: '8px 4px',
                color: token.colorText,
                background: token.colorFillSecondary,
                borderRadius: 6,
                whiteSpace: 'nowrap',
              }}
            >
              {DAY_LABELS[Number(d)] || d}
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
                    color: token.colorTextSecondary,
                    borderTop: `1px dashed ${token.colorBorder}`,
                    paddingTop: 2,
                  }}
                >
                  öğle arası
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: token.colorText }}>
                <span>{p}</span>
                <span style={{ fontSize: 10, fontWeight: 400 }}>
                  {periodClock(project.settings.bell, project.days[0] || 1, p, project.lunch_after)}
                </span>
              </div>
              {project.days.map((d) => {
                const key = `${d}:${p}`
                const items = cellLessons(d, p)
                const state = cellState[`${d}-${p}`]
                const idle = state === 'closed' ? token.colorFillSecondary : state === 'avoid' ? token.colorWarningBg : token.colorBgContainer
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
                      border: `1px ${dropKey === key ? 'dashed' : 'solid'} ${dropKey === key ? token.colorPrimary : token.colorBorder}`,
                      background: dropKey === key ? token.colorPrimaryBg : idle,
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
      {importModal}
      {wipeModal}
    </>
  )
}
