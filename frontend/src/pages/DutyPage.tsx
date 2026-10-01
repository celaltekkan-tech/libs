import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd'
import {
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
import isoWeek from 'dayjs/plugin/isoWeek'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  clearDutyAssignments,
  copyDutyWeek,
  createDutyAssignment,
  createDutyLocation,
  deleteDutyAssignment,
  deleteDutyLocation,
  exportDuty,
  listDutyAssignments,
  listDutyLocations,
  updateDutyLocation,
} from '../api/duty'
import { listScheduleEntries } from '../api/schedule'
import { listTeachers } from '../api/teachers'
import { ApiError, getErrorMessage } from '../api/client'
import type { DutyAssignment, DutyLocation } from '../types/duty'
import type { Teacher } from '../types/teacher'
import type { ScheduleEntry } from '../types/scheduleEntry'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

dayjs.extend(isoWeek)
dayjs.locale('tr')

const WEEKDAY_COUNT = 5
const CAPACITY_STORAGE_KEY = 'duty-daily-capacity'
const WEEKDAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const DUTY_DAY_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#db2777',
]

function capacityStorageKey(tenantId: number) {
  return `${CAPACITY_STORAGE_KEY}:${tenantId}`
}

function readCapacity(tenantId: number): number {
  try {
    const raw = localStorage.getItem(capacityStorageKey(tenantId))
    const n = raw ? Number(raw) : NaN
    if (Number.isFinite(n) && n >= 1 && n <= 50) return Math.floor(n)
  } catch {
    /* ignore */
  }
  return 3
}

function writeCapacity(tenantId: number, value: number) {
  try {
    localStorage.setItem(capacityStorageKey(tenantId), String(value))
  } catch {
    /* ignore */
  }
}

function teacherLabel(t: { first_name: string; last_name: string }) {
  return `${t.first_name} ${t.last_name}`.trim()
}

function compareTeachersTr(a: Teacher, b: Teacher) {
  return teacherLabel(a).localeCompare(teacherLabel(b), 'tr')
}

function currentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

function trDayLabel(day: dayjs.Dayjs) {
  const raw = day.format('dddd')
  return raw.charAt(0).toLocaleUpperCase('tr-TR') + raw.slice(1)
}

function classroomShort(entry: ScheduleEntry) {
  const room = entry.Classroom
  if (!room) return ''
  return `${room.class_level}/${room.section}`
}

function TeacherDutyName({
  name,
  dayIndexes,
  count = 0,
}: {
  name: string
  dayIndexes: number[]
  count?: number
}) {
  const label = count > 0 ? `(${count}) ${name}` : name
  const unique = [...new Set(dayIndexes)].sort((a, b) => a - b)
  if (unique.length === 0) return <span>{label}</span>
  if (unique.length === 1) {
    const color = DUTY_DAY_COLORS[unique[0] % DUTY_DAY_COLORS.length]
    return (
      <span className="duty-teacher-name" style={{ background: color, color: '#fff' }}>
        {label}
      </span>
    )
  }
  const stops = unique
    .map((dayIdx, i) => {
      const color = DUTY_DAY_COLORS[dayIdx % DUTY_DAY_COLORS.length]
      const from = (i / unique.length) * 100
      const to = ((i + 1) / unique.length) * 100
      return `${color} ${from}%, ${color} ${to}%`
    })
    .join(', ')
  return (
    <span
      className="duty-teacher-name"
      style={{ backgroundImage: `linear-gradient(90deg, ${stops})`, color: '#fff' }}
    >
      {label}
    </span>
  )
}

interface CellTarget {
  locationId: number
  date: string
  dayIndex: number
  slot: number
}

export function DutyPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const tenantId = session?.user.tenant_id

  const [locations, setLocations] = useState<DutyLocation[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<DutyAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'))
  const [capacity, setCapacity] = useState(3)

  const [setupOpen, setSetupOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [teacherQuery, setTeacherQuery] = useState('')
  const [listQuery, setListQuery] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [scheduleReady, setScheduleReady] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [shiftLocations, setShiftLocations] = useState(false)
  const teacherListRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeCell, setActiveCell] = useState<CellTarget | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [setupForm] = Form.useForm<{ location_names: string; capacity: number }>()

  const canCreate = hasPermission('duty.create')
  const canDelete = hasPermission('duty.delete')
  const canReadSchedule = hasPermission('schedule.read')
  const ensuredAdminPlace = useRef(false)

  const weekDays = useMemo(
    () => Array.from({ length: WEEKDAY_COUNT }, (_, i) => weekStart.add(i, 'day')),
    [weekStart],
  )
  const startDate = weekDays[0].format('YYYY-MM-DD')
  const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD')

  useEffect(() => {
    if (tenantId != null) setCapacity(readCapacity(tenantId))
  }, [tenantId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [locationData, teacherData, assignmentData] = await Promise.all([
        listDutyLocations(),
        listTeachers({ scope: 'teachers' }),
        listDutyAssignments({ start_date: startDate, end_date: endDate }),
      ])
      setLocations(
        locationData
          .filter((l) => l.is_active)
          .sort(
            (a, b) =>
              (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name, 'tr'),
          ),
      )
      setTeachers([...teacherData].sort(compareTeachersTr))
      setAssignments(assignmentData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!canReadSchedule) {
      setSchedule([])
      setScheduleReady(true)
      return
    }
    let cancelled = false
    setScheduleReady(false)
    const year = currentAcademicYear()
    ;(async () => {
      try {
        let rows = await listScheduleEntries({ academic_year: year })
        if (rows.length === 0) rows = await listScheduleEntries()
        if (!cancelled) setSchedule(rows)
      } catch {
        if (!cancelled) setSchedule([])
      } finally {
        if (!cancelled) setScheduleReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canReadSchedule])

  useEffect(() => {
    if (!loading && locations.length === 0 && canCreate) {
      setupForm.setFieldsValue({ location_names: 'Nöbetçi İdareci', capacity })
      setSetupOpen(true)
    }
  }, [loading, locations.length, canCreate, setupForm, capacity])

  useEffect(() => {
    if (loading || !canCreate || tenantId == null || ensuredAdminPlace.current) return
    if (locations.length === 0) return
    const hasAdmin = locations.some((loc) => loc.name.toLocaleLowerCase('tr-TR').includes('idareci'))
    if (hasAdmin) return
    ensuredAdminPlace.current = true
    void createDutyLocation(tenantId, { name: 'Nöbetçi İdareci' }).then(() => load())
  }, [loading, locations, canCreate, tenantId, load])

  const dutyCountByTeacher = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of assignments) map.set(a.teacher_id, (map.get(a.teacher_id) || 0) + 1)
    return map
  }, [assignments])

  const teacherDayMap = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const a of assignments) {
      const idx = dayjs(a.duty_date).isoWeekday() - 1
      if (idx < 0 || idx > 6) continue
      const list = map.get(a.teacher_id) || []
      if (!list.includes(idx)) list.push(idx)
      map.set(a.teacher_id, list)
    }
    return map
  }, [assignments])

  const assignmentsByLocationDate = useMemo(() => {
    const map = new Map<string, DutyAssignment[]>()
    for (const a of assignments) {
      const key = `${a.duty_location_id}|${a.duty_date}`
      const list = map.get(key) || []
      list.push(a)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.id - b.id)
    return map
  }, [assignments])

  const openSetup = () => {
    setupForm.setFieldsValue({
      location_names: locations.map((l) => l.name).join('\n'),
      capacity,
    })
    setSetupOpen(true)
  }

  const onSetup = async (values: { location_names: string; capacity: number }) => {
    if (!session || tenantId == null) return
    const names = values.location_names
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (names.length === 0) {
      message.warning('En az bir nöbet yeri adı girin')
      return
    }

    const wanted = new Set(names.map((n) => n.toLocaleLowerCase('tr-TR')))
    const removedLocations = locations.filter((loc) => !wanted.has(loc.name.toLocaleLowerCase('tr-TR')))

    const applySetup = async () => {
      setSubmitting(true)
      try {
        const nextCapacity = Math.max(1, Math.min(50, Math.floor(values.capacity || 1)))
        writeCapacity(tenantId, nextCapacity)
        setCapacity(nextCapacity)

        const existingByName = new Map(locations.map((l) => [l.name.toLocaleLowerCase('tr-TR'), l]))

        for (let index = 0; index < names.length; index += 1) {
          const name = names[index]
          const key = name.toLocaleLowerCase('tr-TR')
          const existing = existingByName.get(key)
          if (!existing) {
            await createDutyLocation(tenantId, { name, sort_order: index })
          } else if ((existing.sort_order || 0) !== index) {
            await updateDutyLocation(existing.id, { sort_order: index })
          }
        }

        for (const loc of removedLocations) {
          await deleteDutyLocation(loc.id)
        }

        message.success('Nöbet tablosu hazırlandı')
        setSetupOpen(false)
        void load()
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        setSubmitting(false)
      }
    }

    if (removedLocations.length > 0) {
      modal.confirm({
        title: 'Nöbet yerlerini sil',
        content: `${removedLocations.length} nöbet yeri listeden çıkarılacak ve silinecek. Devam etmek istiyor musunuz?`,
        okText: 'Sil ve kaydet',
        okButtonProps: { danger: true },
        cancelText: 'Vazgeç',
        onOk: () => applySetup(),
      })
      return
    }

    await applySetup()
  }

  const openPicker = (locationId: number, date: dayjs.Dayjs, slot: number) => {
    if (!canCreate && !canDelete) return
    setTeacherQuery('')
    setActiveCell({
      locationId,
      date: date.format('YYYY-MM-DD'),
      dayIndex: date.isoWeekday() - 1,
      slot,
    })
    setPickerOpen(true)
  }

  const assignTeacher = async (teacherId: number) => {
    if (!session || !activeCell) return
    const placeSlots =
      assignmentsByLocationDate.get(`${activeCell.locationId}|${activeCell.date}`) || []
    const existing = placeSlots[activeCell.slot]

    if (!existing && placeSlots.length >= capacity) {
      message.warning(`Bu yerde bu gün en fazla ${capacity} kişi olabilir`)
      return
    }

    const doAssign = async () => {
      setSubmitting(true)
      try {
        if (existing) {
          if (existing.teacher_id === teacherId) {
            setPickerOpen(false)
            return
          }
          await deleteDutyAssignment(existing.id)
        }
        await createDutyAssignment(session.user.tenant_id, {
          teacher_id: teacherId,
          duty_location_id: activeCell.locationId,
          duty_date: activeCell.date,
        })
        message.success('Nöbet atandı')
        setPickerOpen(false)
        setActiveCell(null)
        void load()
      } catch (err) {
        message.error(getErrorMessage(err))
        void load()
      } finally {
        setSubmitting(false)
      }
    }

    if (existing && existing.teacher_id !== teacherId) {
      modal.confirm({
        title: 'Nöbeti değiştir',
        content: 'Mevcut nöbet ataması silinip yenisi kaydedilecek. Devam etmek istiyor musunuz?',
        okText: 'Değiştir',
        okButtonProps: { danger: true },
        cancelText: 'Vazgeç',
        onOk: () => doAssign(),
      })
      return
    }

    await doAssign()
  }

  const clearCell = () => {
    if (!activeCell || !canDelete) return
    const existing = (
      assignmentsByLocationDate.get(`${activeCell.locationId}|${activeCell.date}`) || []
    )[activeCell.slot]
    if (!existing) {
      setPickerOpen(false)
      return
    }
    modal.confirm({
      title: 'Nöbeti kaldır',
      content: 'Bu nöbet atamasını kaldırmak istediğinize emin misiniz?',
      okText: 'Kaldır',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        setSubmitting(true)
        try {
          await deleteDutyAssignment(existing.id)
          message.success('Nöbet kaldırıldı')
          setPickerOpen(false)
          setActiveCell(null)
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const onCopyWeek = async (replace = false) => {
    setSubmitting(true)
    try {
      const result = await copyDutyWeek({
        start_date: startDate,
        shift_locations: shiftLocations,
        replace,
      })
      message.success(
        shiftLocations
          ? `Sonraki haftaya aktarıldı; nöbet yerleri bir sütun kaydı (${result.copied} atama)`
          : `Sonraki haftaya aynı yerlerle aktarıldı (${result.copied} atama)`,
      )
      setCopyOpen(false)
      setWeekStart((w) => w.add(1, 'week'))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TARGET_NONEMPTY' && !replace) {
        modal.confirm({
          title: 'Sonraki haftanın üzerine yaz',
          content: 'Sonraki haftada nöbet var. Bu haftanın nöbeti onların yerine yazılsın mı?',
          okText: 'Üzerine yaz',
          okButtonProps: { danger: true },
          cancelText: 'Vazgeç',
          onOk: () => onCopyWeek(true),
        })
        return
      }
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const clearRange = async (start: string, end: string, successText: string) => {
    setSubmitting(true)
    try {
      const result = await clearDutyAssignments({ start_date: start, end_date: end })
      message.success(result.deleted > 0 ? successText : 'Silinecek atama yoktu')
      setPickerOpen(false)
      setActiveCell(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmClearWeek = () => {
    if (assignments.length === 0) return
    modal.confirm({
      title: 'Tüm atamaları sil',
      content: `${weekDays[0].format('DD.MM.YYYY')} – ${weekDays[weekDays.length - 1].format('DD.MM.YYYY')} arasındaki tüm nöbet atamaları silinecek.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: () => clearRange(startDate, endDate, 'Bu haftanın nöbet atamaları silindi'),
    })
  }

  const confirmClearDay = (date: string, label: string) => {
    modal.confirm({
      title: 'Gün atamasını sil',
      content: `${label} günündeki nöbet atamaları silinecek.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: () => clearRange(date, date, `${label} nöbet atamaları silindi`),
    })
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportDuty({ format: exportFormat, start_date: startDate, end_date: endDate })
      downloadBlob(blob, exportFilename('nobet-cizelgesi', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const teachersBusyOnActiveDay = useMemo(() => {
    if (!activeCell) return new Set<number>()
    const busy = new Set<number>()
    for (const a of assignments) {
      if (a.duty_date === activeCell.date) busy.add(a.teacher_id)
    }
    return busy
  }, [assignments, activeCell])

  const activeAssignment = activeCell
    ? (assignmentsByLocationDate.get(`${activeCell.locationId}|${activeCell.date}`) || [])[
        activeCell.slot
      ]
    : undefined

  const visibleTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLocaleLowerCase('tr-TR')
    if (!q) return teachers
    return teachers.filter((t) => teacherLabel(t).toLocaleLowerCase('tr-TR').includes(q))
  }, [teachers, teacherQuery])

  useEffect(() => {
    if (!pickerOpen) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (event.key.length !== 1 || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(event.key)) return
      const key = event.key.toLocaleLowerCase('tr-TR')
      const match = visibleTeachers.find((t) => t.first_name.toLocaleLowerCase('tr-TR').startsWith(key))
      if (!match || !teacherListRef.current) return
      const node = teacherListRef.current.querySelector(`[data-teacher-id="${match.id}"]`)
      if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen, visibleTeachers])

  const pickerContent = (
    <div className="duty-teacher-picker">
      <div className="duty-teacher-picker-head">
        <Typography.Text strong>Öğretmen seç</Typography.Text>
        {activeAssignment && canDelete && (
          <Button size="small" type="link" danger onClick={() => clearCell()} disabled={submitting}>
            Kaldır
          </Button>
        )}
      </div>
      <Input
        allowClear
        size="small"
        placeholder="Öğretmen ara"
        value={teacherQuery}
        onChange={(event) => setTeacherQuery(event.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div className="duty-teacher-picker-list" ref={teacherListRef}>
        {visibleTeachers.map((t) => {
          const days = teacherDayMap.get(t.id) || []
          const busyOther =
            teachersBusyOnActiveDay.has(t.id) && activeAssignment?.teacher_id !== t.id
          const selected = activeAssignment?.teacher_id === t.id
          return (
            <button
              key={t.id}
              type="button"
              data-teacher-id={t.id}
              className={`duty-teacher-picker-item${selected ? ' is-selected' : ''}${busyOther ? ' is-disabled' : ''}`}
              disabled={busyOther || submitting || !canCreate}
              onClick={() => void assignTeacher(t.id)}
            >
              <TeacherDutyName
                name={teacherLabel(t)}
                dayIndexes={days}
                count={dutyCountByTeacher.get(t.id) || 0}
              />
              {days.length > 0 && (
                <span className="duty-teacher-picker-hint">
                  {[...days]
                    .sort((a, b) => a - b)
                    .map((dayIdx) => WEEKDAY_NAMES[dayIdx])
                    .join(', ')}
                </span>
              )}
              {busyOther && <span className="duty-teacher-picker-hint">bu gün dolu</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  const slotIndexes = useMemo(() => Array.from({ length: capacity }, (_, i) => i), [capacity])

  const listedTeachers = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase('tr-TR')
    if (!q) return teachers
    return teachers.filter((t) => teacherLabel(t).toLocaleLowerCase('tr-TR').includes(q))
  }, [teachers, listQuery])

  const periodCount = useMemo(() => {
    const max = schedule.reduce((highest, entry) => Math.max(highest, entry.period_no || 0), 0)
    return max
  }, [schedule])

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId) || null

  const selectedLessons = useMemo(() => {
    if (selectedTeacherId == null) return []
    return schedule.filter(
      (entry) =>
        entry.teacher_id === selectedTeacherId ||
        (entry.co_teacher_ids || []).includes(selectedTeacherId),
    )
  }, [schedule, selectedTeacherId])

  const dutyDatesByTeacher = useMemo(() => {
    const map = new Map<number, Set<string>>()
    for (const a of assignments) {
      const set = map.get(a.teacher_id) || new Set<string>()
      set.add(a.duty_date.slice(0, 10))
      map.set(a.teacher_id, set)
    }
    return map
  }, [assignments])

  return (
    <AppLayout title="Nöbet Programı">
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Nöbet Programı
          </Typography.Title>
          <Typography.Text type="secondary">
            Bir yere birden fazla kişi yazılabilir. Aynı kişi aynı gün yalnızca bir kez yazılır; haftanın başka günlerinde de olabilir. Öğretmen listesinde kaç nöbet yazıldığı görünür; ada tıklayınca ders programı açılır.
          </Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<SettingOutlined />} onClick={openSetup}>
            Tabloyu ayarla
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
        </Space>
      </Space>

      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<LeftOutlined />} onClick={() => setWeekStart((w) => w.subtract(1, 'week'))} />
        <DatePicker
          picker="week"
          value={weekStart}
          onChange={(v) => v && setWeekStart(v.startOf('isoWeek'))}
          format={(v) =>
            `${v.startOf('isoWeek').format('DD.MM.YYYY')} – ${v.startOf('isoWeek').add(4, 'day').format('DD.MM.YYYY')}`
          }
          allowClear={false}
        />
        <Button icon={<RightOutlined />} onClick={() => setWeekStart((w) => w.add(1, 'week'))} />
        <Button type="link" onClick={() => setWeekStart(dayjs().startOf('isoWeek'))}>
          Bu hafta
        </Button>
        {canCreate && (
          <Button onClick={() => setCopyOpen(true)} disabled={assignments.length === 0}>
            Sonraki haftaya aktar
          </Button>
        )}
        {canDelete && (
          <Button danger disabled={assignments.length === 0 || submitting} onClick={confirmClearWeek}>
            Tüm atamaları sil
          </Button>
        )}
      </Space>

      <Spin spinning={loading}>
        {locations.length === 0 ? (
          <div className="duty-empty">
            <Typography.Paragraph>
              Henüz nöbet yeri yok. Tabloyu ayarlayarak yer isimlerini ve günlük nöbetçi kapasitesini girin.
            </Typography.Paragraph>
            {canCreate && (
              <Button type="primary" onClick={openSetup}>
                Tabloyu ayarla
              </Button>
            )}
          </div>
        ) : (
          <div className="duty-workspace">
            <aside className="duty-teacher-panel">
              <Typography.Text strong>Öğretmenler</Typography.Text>
              <Input
                allowClear
                size="small"
                placeholder="Öğretmen ara"
                value={listQuery}
                onChange={(event) => setListQuery(event.target.value)}
                style={{ marginTop: 8 }}
              />
              <div className="duty-teacher-panel-list">
                {listedTeachers.map((t) => {
                  const days = teacherDayMap.get(t.id) || []
                  const selected = selectedTeacherId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`duty-teacher-panel-item${selected ? ' is-selected' : ''}`}
                      onClick={() =>
                        setSelectedTeacherId((current) => (current === t.id ? null : t.id))
                      }
                    >
                      <TeacherDutyName
                        name={teacherLabel(t)}
                        dayIndexes={days}
                        count={dutyCountByTeacher.get(t.id) || 0}
                      />
                    </button>
                  )
                })}
                {listedTeachers.length === 0 && (
                  <Typography.Text type="secondary">Öğretmen bulunamadı</Typography.Text>
                )}
              </div>
            </aside>
            <div className="duty-workspace-main">
              {selectedTeacher && (
                <div className="duty-schedule-block">
                  <Typography.Text strong>
                    {teacherLabel(selectedTeacher)} — ders programı
                  </Typography.Text>
                  {!scheduleReady ? (
                    <div className="duty-schedule-status">
                      <Spin size="small" />
                    </div>
                  ) : !canReadSchedule ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Ders programını görmek için yetki gerekir.
                    </Typography.Paragraph>
                  ) : periodCount === 0 ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Yayınlanmış ders programı bulunamadı.
                    </Typography.Paragraph>
                  ) : selectedLessons.length === 0 ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Bu öğretmenin ders programında kaydı yok.
                    </Typography.Paragraph>
                  ) : (
                    <div className="duty-schedule-cards">
                      {weekDays.map((day) => {
                        const dayIndex = day.isoWeekday() - 1
                        const dow = dayIndex + 1
                        const date = day.format('YYYY-MM-DD')
                        const onDuty = dutyDatesByTeacher.get(selectedTeacher.id)?.has(date)
                        const color = DUTY_DAY_COLORS[dayIndex]
                        return (
                          <article
                            key={date}
                            className="duty-schedule-card"
                            style={{ borderTopColor: color }}
                          >
                            <header className="duty-schedule-card-head">
                              <span style={{ color }}>{trDayLabel(day)}</span>
                              {onDuty ? <span className="duty-schedule-duty">nöbetli</span> : null}
                            </header>
                            {Array.from({ length: periodCount }, (_, index) => index + 1).map((period) => {
                              const lessons = selectedLessons.filter(
                                (entry) => entry.day_of_week === dow && entry.period_no === period,
                              )
                              if (lessons.length === 0) {
                                return (
                                  <div key={period} className="duty-schedule-slot is-free">
                                    <span className="duty-schedule-period">{period}</span>
                                    <span>boş</span>
                                  </div>
                                )
                              }
                              return (
                                <div key={period} className="duty-schedule-slot">
                                  <span className="duty-schedule-period">{period}</span>
                                  <span>
                                    {lessons
                                      .map((lesson) => {
                                        const subject = lesson.Subject?.name || 'Ders'
                                        const room = classroomShort(lesson)
                                        return room ? `${subject} · ${room}` : subject
                                      })
                                      .join(', ')}
                                  </span>
                                </div>
                              )
                            })}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
          <div className="duty-grid-wrap">
            <table className="duty-grid">
              <thead>
                <tr>
                  <th className="duty-grid-corner">Gün</th>
                  {locations.map((loc) => (
                    <th key={loc.id}>{loc.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day) => {
                  const dateStr = day.format('YYYY-MM-DD')
                  const dayIndex = day.isoWeekday() - 1
                  const color = DUTY_DAY_COLORS[dayIndex]
                  const dayCount = assignments.filter((a) => a.duty_date === dateStr).length

                  return slotIndexes.map((slot) => {
                    const isFirstSlot = slot === 0

                    return (
                      <tr key={`${dateStr}-${slot}`} className={isFirstSlot ? 'duty-day-start' : undefined}>
                        {isFirstSlot ? (
                          <th
                            className="duty-grid-day"
                            rowSpan={capacity}
                            style={{ borderLeftColor: color }}
                          >
                            <span className="duty-grid-day-name" style={{ color }}>
                              {day.format('dddd')}
                            </span>
                            <span className="duty-grid-day-meta">
                              {day.format('DD.MM')} · {dayCount} kişi
                            </span>
                            {canDelete && (
                              <Button
                                type="link"
                                size="small"
                                danger
                                className="duty-grid-day-clear"
                                disabled={dayCount === 0 || submitting}
                                onClick={() => confirmClearDay(dateStr, trDayLabel(day))}
                              >
                                Gün atamasını sil
                              </Button>
                            )}
                          </th>
                        ) : null}

                        {locations.map((loc) => {
                          const placeSlots = assignmentsByLocationDate.get(`${loc.id}|${dateStr}`) || []
                          const cellAssignment = placeSlots[slot] || null
                          const locked = !cellAssignment && slot !== placeSlots.length

                          const isActive =
                            activeCell?.locationId === loc.id &&
                            activeCell?.date === dateStr &&
                            activeCell?.slot === slot &&
                            pickerOpen

                          const cellButton = (
                            <button
                              type="button"
                              className={`duty-grid-cell${cellAssignment ? ' has-teacher' : ''}${locked ? ' is-locked' : ''}${isActive ? ' is-active' : ''}`}
                              style={
                                cellAssignment ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined
                              }
                              disabled={locked && !cellAssignment}
                              onClick={() => {
                                if (locked && !cellAssignment) return
                                openPicker(loc.id, day, slot)
                              }}
                            >
                              {cellAssignment?.Teacher ? (
                                <TeacherDutyName
                                  name={teacherLabel(cellAssignment.Teacher)}
                                  dayIndexes={
                                    teacherDayMap.get(cellAssignment.teacher_id) || [dayIndex]
                                  }
                                  count={dutyCountByTeacher.get(cellAssignment.teacher_id) || 0}
                                />
                              ) : locked ? (
                                <span className="duty-grid-placeholder is-muted">—</span>
                              ) : (
                                <span className="duty-grid-placeholder">+</span>
                              )}
                            </button>
                          )

                          return (
                            <td key={loc.id}>
                              {isActive ? (
                                <Popover
                                  open
                                  content={pickerContent}
                                  trigger="click"
                                  placement="bottom"
                                  onOpenChange={(open) => {
                                    if (!open) {
                                      setPickerOpen(false)
                                      setActiveCell(null)
                                    }
                                  }}
                                >
                                  {cellButton}
                                </Popover>
                              ) : (
                                cellButton
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>

            <div className="duty-legend">
              {weekDays.map((day) => {
                const dayIndex = day.isoWeekday() - 1
                return (
                  <span key={dayIndex} className="duty-legend-item">
                    <i style={{ background: DUTY_DAY_COLORS[dayIndex] }} />
                    {day.format('dddd')}
                  </span>
                )
              })}
            </div>
            </div>
            </div>
          </div>
        )}
      </Spin>

      <Modal
        title="Nöbet tablosunu ayarla"
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        onOk={() => setupForm.submit()}
        confirmLoading={submitting}
        okText="Tabloyu hazırla"
        cancelText="Vazgeç"
        destroyOnHidden
        width={480}
        afterOpenChange={(open) => {
          if (!open) return
          setupForm.setFieldsValue({
            location_names: locations.map((l) => l.name).join('\n') || 'Nöbetçi İdareci',
            capacity,
          })
        }}
      >
        <Typography.Paragraph type="secondary">
          Nöbet yeri isimlerini ve her gün kaç nöbetçi olabileceğini girin. Tablo boş hazırlanır; atamaları
          kutucuklara tıklayarak yaparsınız.
        </Typography.Paragraph>
        <Form
          form={setupForm}
          layout="vertical"
          onFinish={onSetup}
        >
          <Form.Item
            name="location_names"
            label="Nöbet yerleri"
            rules={[{ required: true, message: 'En az bir yer adı girin' }]}
            extra="Her satıra bir yer yazın (veya virgülle ayırın)."
          >
            <Input.TextArea rows={5} placeholder={'Nöbetçi İdareci\nGiriş\nKoridor\nBahçe'} />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Günlük nöbetçi kapasitesi"
            rules={[{ required: true, message: 'Kapasite zorunludur' }]}
            extra="Her nöbet yerinde, bir günde en fazla kaç kişi yazılabilir. Aynı kişi aynı gün ikinci kez yazılmaz."
          >
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        {locations.length > 0 && (
          <Typography.Text type="warning">
            Listeden çıkardığınız yerler silinir; o yerlere ait nöbet atamaları da kalkabilir.
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title="Sonraki haftaya aktar"
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        onOk={() => void onCopyWeek(false)}
        confirmLoading={submitting}
        okText="Aktar"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Typography.Paragraph>
          Bu haftanın nöbeti, aynı günlerde sonraki haftaya yazılır.
        </Typography.Paragraph>
        <Checkbox checked={shiftLocations} onChange={(event) => setShiftLocations(event.target.checked)}>
          Nöbet yerlerini bir sütun kaydır
        </Checkbox>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          İşaretlenmezse kişiler aynı yerde kalır. İşaretlenirse günleri değişmez, tuttukları yer bir sonraki sütuna kayar.
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Nöbet çizelgesini dışa aktar"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        confirmLoading={submitting}
        okText="İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Biçim">
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV (.csv)' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            Seçili hafta: {weekDays[0].format('DD.MM.YYYY')} –{' '}
            {weekDays[weekDays.length - 1].format('DD.MM.YYYY')}
          </Typography.Text>
        </Form>
      </Modal>
    </AppLayout>
  )
}
