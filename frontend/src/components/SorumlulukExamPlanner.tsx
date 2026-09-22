import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  List,
  Modal,
  Popover,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  TimePicker,
  theme,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { toJpeg } from 'html-to-image'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  deleteAllSorumlulukItems,
  exportSorumlulukExams,
  listSorumlulukItems,
  scheduleSorumlulukSubject,
} from '../api/exams'
import { listScheduleTeachers } from '../api/schedule'
import type { ScheduleTeacherOption } from '../api/schedule'
import { fetchSchoolPrincipal, listTeachers } from '../api/teachers'
import type { Teacher } from '../types/teacher'
import { getErrorMessage } from '../api/client'
import type { CommitteeMember, ResponsibilityExamItem } from '../types/exam'
import { sorumlulukSubjectKey, sorumlulukSubjectLabel } from '../types/exam'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { TypedPhraseConfirmModal } from './TypedPhraseConfirmModal'
import { SorumlulukExamImportModal } from './SorumlulukExamImportModal'
import { SorumlulukExamAddModal } from './SorumlulukExamAddModal'
import { SorumlulukExamCommitteeModal } from './SorumlulukExamCommitteeModal'
import { FilterBar } from './FilterBar'
import { ClearFiltersButton } from './ClearFiltersButton'
import {
  dutyCounts,
  foldName,
  isDualSubject,
  roleLabel,
  suggestMembers,
  type ExamKind,
  type SchoolLanguages,
} from '../utils/sorumlulukExam'

dayjs.extend(isoWeek)

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const LEVEL_COLORS: Record<string, string> = {
  '5': '#0369a1',
  '6': '#0f766e',
  '7': '#7c3aed',
  '8': '#be123c',
  '9': '#1d4e89',
  '10': '#0f766e',
  '11': '#b45309',
  '12': '#9f1239',
}

function levelColor(level: string): string {
  return LEVEL_COLORS[level] || '#334155'
}

function softBg(hex: string): string {
  return `${hex}22`
}

function sortClassLevels(levels: string[]): string[] {
  return [...levels].sort((a, b) => {
    const na = Number.parseInt(a, 10)
    const nb = Number.parseInt(b, 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
    return a.localeCompare(b, 'tr')
  })
}

function startOfTwoWeekWindow(d: Dayjs): Dayjs {
  return d.startOf('isoWeek')
}

function parseClock(value: string | null): Dayjs | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map((part) => Number(part))
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0)
}

export interface SorumlulukSubjectSlot {
  key: string
  subject_class_level: string
  subject_name: string
  subject_id: number | null
  student_count: number
  exam_date: string | null
  oral_exam_date: string | null
  teacher_id: number | null
  start_time: string | null
  oral_start_time: string | null
  committee_members: CommitteeMember[] | null
}

interface CalendarExamChip {
  slot: SorumlulukSubjectSlot
  kind: ExamKind
  date: string
  time: string | null
}

interface SorumlulukExamPlannerProps {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

type PlannerExportFormat = ExportFormat | 'jpeg'

export function SorumlulukExamPlanner({ canCreate, canUpdate, canDelete }: SorumlulukExamPlannerProps) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { activeSchoolId, activeSchool } = useActiveSchool()
  const schoolLanguages = useMemo<SchoolLanguages>(
    () => ({
      first: activeSchool?.meta?.first_foreign_language || null,
      second: activeSchool?.meta?.second_foreign_language || null,
    }),
    [activeSchool],
  )
  const gridRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<'manuel' | 'otomatik'>('manuel')
  const [windowStart, setWindowStart] = useState<Dayjs>(() => startOfTwoWeekWindow(dayjs()))
  const [items, setItems] = useState<ResponsibilityExamItem[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [autoRange, setAutoRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [autoSkipTime, setAutoSkipTime] = useState(true)
  const [autoStartTime, setAutoStartTime] = useState<Dayjs | null>(null)
  const [committeeSlot, setCommitteeSlot] = useState<SorumlulukSubjectSlot | null>(null)
  const [committeeDate, setCommitteeDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<PlannerExportFormat>('xlsx')
  const [scheduleTeachers, setScheduleTeachers] = useState<ScheduleTeacherOption[]>([])
  const [staffTeachers, setStaffTeachers] = useState<Teacher[]>([])
  const [principalName, setPrincipalName] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [timeTarget, setTimeTarget] = useState<{ key: string; kind: ExamKind } | null>(null)
  const [dayTimeTarget, setDayTimeTarget] = useState<string | null>(null)
  const [draftTime, setDraftTime] = useState<Dayjs | null>(null)
  const dragHappened = useRef(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [listQuery, setListQuery] = useState('')
  const [listSection, setListSection] = useState<string | null>(null)
  const [listSubjectLevel, setListSubjectLevel] = useState<string | null>(null)
  const [listSubject, setListSubject] = useState<string | null>(null)
  const [listDate, setListDate] = useState<'all' | 'dated' | 'undated'>('all')

  const windowEnd = useMemo(() => windowStart.add(13, 'day'), [windowStart])
  const dayRows = useMemo(
    () => Array.from({ length: 14 }, (_, i) => windowStart.add(i, 'day')),
    [windowStart],
  )
  const weeks = useMemo(() => {
    const rows: Dayjs[][] = []
    for (let i = 0; i < dayRows.length; i += 7) rows.push(dayRows.slice(i, i + 7))
    return rows
  }, [dayRows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, teachers, principal, staff] = await Promise.all([
        listSorumlulukItems(),
        listScheduleTeachers().catch(() => []),
        activeSchoolId ? fetchSchoolPrincipal(activeSchoolId).catch(() => null) : Promise.resolve(null),
        listTeachers(activeSchoolId ? { scope: 'all', school_id: activeSchoolId } : { scope: 'all' }).catch(
          () => [],
        ),
      ])
      setItems(rows)
      setScheduleTeachers(teachers)
      setPrincipalName(principal)
      setStaffTeachers(staff)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, activeSchoolId])

  useEffect(() => {
    void load()
  }, [load])

  const subjects = useMemo(() => {
    const map = new Map<string, SorumlulukSubjectSlot>()
    for (const item of items) {
      const key = sorumlulukSubjectKey(item)
      const existing = map.get(key)
      if (existing) {
        existing.student_count += 1
        if (!existing.exam_date && item.exam_date) existing.exam_date = item.exam_date
        if (!existing.oral_exam_date && item.oral_exam_date) existing.oral_exam_date = item.oral_exam_date
        if (!existing.start_time && item.start_time) existing.start_time = item.start_time
        if (!existing.oral_start_time && item.oral_start_time) existing.oral_start_time = item.oral_start_time
        if (!existing.teacher_id && item.teacher_id) existing.teacher_id = item.teacher_id
        if (!existing.subject_id && item.subject_id) existing.subject_id = item.subject_id
        if (!existing.committee_members && item.committee_members) {
          existing.committee_members = item.committee_members
        }
      } else {
        map.set(key, {
          key,
          subject_class_level: item.subject_class_level,
          subject_name: item.subject_name,
          subject_id: item.subject_id,
          student_count: 1,
          exam_date: item.exam_date,
          oral_exam_date: item.oral_exam_date,
          teacher_id: item.teacher_id,
          start_time: item.start_time,
          oral_start_time: item.oral_start_time,
          committee_members: item.committee_members,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const level = a.subject_class_level.localeCompare(b.subject_class_level, 'tr', { numeric: true })
      if (level) return level
      return a.subject_name.localeCompare(b.subject_name, 'tr')
    })
  }, [items])

  const classLevels = useMemo(
    () => sortClassLevels([...new Set(subjects.map((s) => s.subject_class_level))]),
    [subjects],
  )

  const subjectsByDateLevel = useMemo(() => {
    const map = new Map<string, CalendarExamChip[]>()
    const push = (slot: SorumlulukSubjectSlot, kind: ExamKind, date: string | null, time: string | null) => {
      if (!date) return
      const key = `${date}|${slot.subject_class_level}`
      const list = map.get(key) || []
      list.push({ slot, kind, date, time })
      map.set(key, list)
    }
    for (const slot of subjects) {
      push(slot, 'yazili', slot.exam_date, slot.start_time)
      push(slot, 'sozlu', slot.oral_exam_date, slot.oral_start_time)
    }
    return map
  }, [subjects])

  const studentsBySubjectDate = useMemo(() => {
    const map = new Map<string, ResponsibilityExamItem[]>()
    for (const item of items) {
      const subjectKey = sorumlulukSubjectKey(item)
      for (const date of [item.exam_date, item.oral_exam_date]) {
        if (!date) continue
        const key = `${date}|${subjectKey}`
        const list = map.get(key) || []
        if (!list.includes(item)) list.push(item)
        map.set(key, list)
      }
    }
    return map
  }, [items])

  const selectedSubject = subjects.find((s) => s.key === selectedKey) || null
  const studentCount = useMemo(
    () => new Set(items.map((i) => i.student_number)).size,
    [items],
  )
  const scheduledCount = subjects.filter((s) => s.exam_date).length

  const overlappingStudents = (slot: SorumlulukSubjectSlot, dateStr: string) => {
    const taking = items.filter((i) => sorumlulukSubjectKey(i) === slot.key)
    const nos = new Set(taking.map((i) => i.student_number))
    return items.filter(
      (i) =>
        (i.exam_date === dateStr || i.oral_exam_date === dateStr) &&
        nos.has(i.student_number) &&
        sorumlulukSubjectKey(i) !== slot.key,
    )
  }

  const saveSlot = async (
    slot: SorumlulukSubjectSlot,
    patch: {
      exam_date: string | null
      start_time: string | null
      oral_exam_date: string | null
      oral_start_time: string | null
    },
  ) => {
    if (patch.exam_date && patch.oral_exam_date && patch.exam_date === patch.oral_exam_date) {
      message.error('Yazılı ve sözlü sınav aynı güne konamaz')
      return null
    }
    return scheduleSorumlulukSubject({
      subject_class_level: slot.subject_class_level,
      subject_name: slot.subject_name,
      duration_minutes: 40,
      exam_date: patch.exam_date,
      start_time: patch.start_time,
      oral_exam_date: patch.oral_exam_date,
      oral_start_time: patch.oral_start_time,
      ...(slot.teacher_id ? { teacher_id: slot.teacher_id } : {}),
      ...(slot.committee_members ? { committee_members: slot.committee_members } : {}),
    })
  }

  const placeSubjectOnDate = async (
    slot: SorumlulukSubjectSlot,
    dateStr: string | null,
    kind: ExamKind = 'yazili',
  ) => {
    if (!canUpdate && !canCreate) return
    setSubmitting(true)
    try {
      const written = kind === 'yazili' ? dateStr : slot.exam_date
      const oral = kind === 'sozlu' ? dateStr : slot.oral_exam_date
      const result = await saveSlot(slot, {
        exam_date: written,
        start_time: slot.start_time,
        oral_exam_date: oral,
        oral_start_time: slot.oral_start_time,
      })
      if (!result) return
      const label = kind === 'sozlu' ? 'Sözlü' : 'Yazılı'
      if (dateStr) {
        message.success(`${sorumlulukSubjectLabel(slot)} ${label} → ${dateStr} (${slot.student_count} öğrenci)`)
      } else {
        message.success(`${sorumlulukSubjectLabel(slot)} ${label} takvimden kaldırıldı`)
      }
      if (result.warning) modal.warning({ title: 'Öğrenci çakışması', content: result.warning })
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const setExamTime = async (slot: SorumlulukSubjectSlot, kind: ExamKind, time: string | null) => {
    if (!canUpdate && !canCreate) return
    setSubmitting(true)
    try {
      const result = await saveSlot(slot, {
        exam_date: slot.exam_date,
        start_time: kind === 'yazili' ? time : slot.start_time,
        oral_exam_date: slot.oral_exam_date,
        oral_start_time: kind === 'sozlu' ? time : slot.oral_start_time,
      })
      if (!result) return
      message.success(time ? `Saat ${time} olarak kaydedildi` : 'Saat kaldırıldı')
      setTimeTarget(null)
      setDayTimeTarget(null)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const applyDayTime = async (dateStr: string) => {
    if (!draftTime) {
      message.warning('Saat seçin')
      return
    }
    const time = draftTime.format('HH:mm')
    const chips = classLevels.flatMap((level) => subjectsByDateLevel.get(`${dateStr}|${level}`) || [])
    if (chips.length === 0) {
      message.info('Bu günde sınav yok. Önce bir ders yerleştirin.')
      return
    }
    setSubmitting(true)
    try {
      for (const chip of chips) {
        const result = await saveSlot(chip.slot, {
          exam_date: chip.slot.exam_date,
          start_time: chip.kind === 'yazili' ? time : chip.slot.start_time,
          oral_exam_date: chip.slot.oral_exam_date,
          oral_start_time: chip.kind === 'sozlu' ? time : chip.slot.oral_start_time,
        })
        if (!result) return
      }
      message.success('Saat kaydedildi')
      setDayTimeTarget(null)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSelectDay = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    if (mode === 'manuel' && (canCreate || canUpdate) && selectedSubject) {
      const overlaps = overlappingStudents(selectedSubject, dateStr)
      if (overlaps.length > 0) {
        const names = [...new Set(overlaps.map((o) => o.student_name))].slice(0, 6).join(', ')
        modal.confirm({
          title: 'Aynı gün başka sınavı olan öğrenciler var',
          content: `${names}${overlaps.length > 6 ? '…' : ''} bu tarihte başka sorumluluk sınavına giriyor. Yine de yerleştirilsin mi?`,
          okText: 'Yerleştir',
          cancelText: 'Vazgeç',
          onOk: () => placeSubjectOnDate(selectedSubject, dateStr),
        })
        return
      }
      void placeSubjectOnDate(selectedSubject, dateStr)
      return
    }
    setDayModalDate(dateStr)
  }

  const onAutoGenerate = async () => {
    if (!autoRange) {
      message.warning('Tarih aralığı seçin')
      return
    }
    if (!autoSkipTime && !autoStartTime) {
      message.warning('Sınav saatini seçin veya "Saat bilgisi girmeyeceğim" seçeneğini işaretleyin')
      return
    }
    const startTime = !autoSkipTime && autoStartTime ? autoStartTime.format('HH:mm') : null
    const pending = subjects.filter((s) => !s.exam_date)
    if (pending.length === 0) {
      message.info('Tarihlenecek ders kalmadı')
      return
    }

    const weekdays: string[] = []
    let cursor = autoRange[0].startOf('day')
    const end = autoRange[1].startOf('day')
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const dow = cursor.day()
      if (dow >= 1 && dow <= 5) weekdays.push(cursor.format('YYYY-MM-DD'))
      cursor = cursor.add(1, 'day')
    }
    if (weekdays.length === 0) {
      message.warning('Seçilen aralıkta hafta içi gün yok')
      return
    }

    const occupancy = new Map<string, Set<string>>()
    const markBusy = (date: string | null, numbers: Iterable<string>) => {
      if (!date) return
      const set = occupancy.get(date) || new Set<string>()
      for (const no of numbers) set.add(no)
      occupancy.set(date, set)
    }
    for (const item of items) {
      markBusy(item.exam_date, [item.student_number])
      markBusy(item.oral_exam_date, [item.student_number])
    }

    const pickDay = (taking: Set<string>, avoid: string | null) => {
      for (const d of weekdays) {
        if (d === avoid) continue
        const busy = occupancy.get(d) || new Set<string>()
        if (![...taking].some((no) => busy.has(no))) return d
      }
      return weekdays.find((d) => d !== avoid) || null
    }

    const ordered = [...pending].sort((a, b) => b.student_count - a.student_count)
    const assignments: { slot: SorumlulukSubjectSlot; date: string; oralDate: string | null }[] = []

    for (const slot of ordered) {
      const taking = new Set(
        items.filter((i) => sorumlulukSubjectKey(i) === slot.key).map((i) => i.student_number),
      )
      const chosen = pickDay(taking, null) || weekdays[assignments.length % weekdays.length]
      markBusy(chosen, taking)
      let oralDate: string | null = null
      if (isDualSubject(slot.subject_name)) {
        oralDate = pickDay(taking, chosen)
        if (oralDate) markBusy(oralDate, taking)
      }
      assignments.push({ slot, date: chosen, oralDate })
    }

    modal.confirm({
      title: 'Otomatik sorumluluk programı',
      content: `${assignments.length} ders, seçilen aralıktaki hafta içi günlere yerleştirilecek. Aynı öğrencinin iki sınavı mümkün olduğunca ayrı günlere konur. Devam edilsin mi?`,
      okText: 'Oluştur',
      cancelText: 'Vazgeç',
      onOk: async () => {
        setSubmitting(true)
        try {
          for (const { slot, date, oralDate } of assignments) {
            await scheduleSorumlulukSubject({
              subject_class_level: slot.subject_class_level,
              subject_name: slot.subject_name,
              exam_date: date,
              start_time: startTime,
              oral_exam_date: oralDate,
              oral_start_time: oralDate ? startTime : null,
              duration_minutes: 40,
            })
          }
          message.success(`${assignments.length} ders tarihlendi`)
          await load()
        } catch (err) {
          message.error(getErrorMessage(err))
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const committeeTeachers = useMemo(() => {
    const byId = new Map<number, ScheduleTeacherOption>()
    for (const teacher of scheduleTeachers) byId.set(teacher.id, { ...teacher, subject_names: [...teacher.subject_names] })
    for (const teacher of staffTeachers) {
      const existing = byId.get(teacher.id)
      const branch = teacher.brans ? [teacher.brans] : []
      if (!existing) {
        byId.set(teacher.id, {
          id: teacher.id,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          personnel_no: teacher.personnel_no,
          subject_ids: [],
          classroom_ids: [],
          subject_names: branch,
        })
      } else if (teacher.brans && !existing.subject_names.some((name) => foldName(name) === foldName(teacher.brans || ''))) {
        existing.subject_names = [...existing.subject_names, teacher.brans]
      }
    }
    return [...byId.values()]
  }, [scheduleTeachers, staffTeachers])

  const teacherNameById = useMemo(
    () => new Map(committeeTeachers.map((t) => [t.id, `${t.first_name} ${t.last_name}`])),
    [committeeTeachers],
  )

  const principalTeacherId = useMemo(() => {
    if (!principalName) return null
    const target = foldName(principalName)
    return committeeTeachers.find((teacher) => foldName(`${teacher.first_name} ${teacher.last_name}`) === target)?.id ?? null
  }, [committeeTeachers, principalName])

  const suggestedName = (slot: SorumlulukSubjectSlot): string => {
    const members = (slot.committee_members || []).filter((item) => item.role === 'uye')
    if (members.length) {
      return members
        .map((member) => teacherNameById.get(member.teacher_id) || '')
        .filter(Boolean)
        .join(', ')
    }
    return suggestMembers(
      slot,
      committeeTeachers,
      principalTeacherId ? [principalTeacherId] : [],
      schoolLanguages,
    )
      .map((teacher) => `${teacher.first_name} ${teacher.last_name}`)
      .join(', ')
  }

  const committeeSummary = (slot: SorumlulukSubjectSlot): string => {
    if (slot.committee_members && slot.committee_members.length > 0) {
      return slot.committee_members
        .map((m) => {
          const name = teacherNameById.get(m.teacher_id)
          if (!name) return null
          return `${name} (${roleLabel(m.role)})`
        })
        .filter((v): v is string => !!v)
        .join(', ')
    }
    if (slot.teacher_id) return teacherNameById.get(slot.teacher_id) || ''
    return ''
  }

  const downloadDutyReport = () => {
    const counts = dutyCounts(subjects)
    const lines = ['Tarih;Tür;Sınıf;Ders;Öğrenci sayısı;Rol;Öğretmen']
    const pushRow = (
      date: string | null,
      kind: string,
      slot: SorumlulukSubjectSlot,
      role: string,
      teacherId: number,
    ) => {
      if (!date) return
      const name = teacherNameById.get(teacherId) || String(teacherId)
      lines.push(
        [date, kind, slot.subject_class_level, slot.subject_name, String(slot.student_count), role, name].join(';'),
      )
    }
    for (const slot of subjects) {
      const members = slot.committee_members || []
      const people = members.length
        ? members
        : slot.teacher_id
          ? [{ teacher_id: slot.teacher_id, role: 'baskan' as const }]
          : []
      for (const member of people) {
        if (slot.exam_date) pushRow(slot.exam_date, 'Yazılı', slot, roleLabel(member.role), member.teacher_id)
        if (slot.oral_exam_date && member.role !== 'gozetmen') {
          pushRow(slot.oral_exam_date, 'Sözlü', slot, roleLabel(member.role), member.teacher_id)
        }
      }
    }
    lines.push('')
    lines.push('Öğretmen;Tarihli sınav sayısı')
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    for (const [id, count] of ranked) {
      lines.push(`${teacherNameById.get(id) || id};${count}`)
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, exportFilename('sorumluluk-gorev-sayilari', 'csv'))
  }

  const onExportJpeg = async () => {
    const node = gridRef.current
    if (!node) {
      message.warning('Takvim alanı hazır değil')
      return
    }
    const dataUrl = await toJpeg(node, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    })
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    downloadBlob(blob, `sorumluluk-sinav-programi-${windowStart.format('YYYYMMDD')}.jpeg`)
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      if (exportFormat === 'jpeg') {
        await onExportJpeg()
      } else {
        const blob = await exportSorumlulukExams({ format: exportFormat })
        downloadBlob(blob, exportFilename('sorumluluk-sinav-programi', exportFormat))
      }
      message.success('Dışa aktarma indirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const result = await deleteAllSorumlulukItems()
      message.success(`${result.deleted} kayıt silindi`)
      setBulkOpen(false)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBulkLoading(false)
    }
  }

  const dayModalSlots = useMemo(() => {
    if (!dayModalDate) return []
    const chips: CalendarExamChip[] = []
    for (const slot of subjects) {
      if (slot.exam_date === dayModalDate) {
        chips.push({ slot, kind: 'yazili', date: dayModalDate, time: slot.start_time })
      }
      if (slot.oral_exam_date === dayModalDate) {
        chips.push({ slot, kind: 'sozlu', date: dayModalDate, time: slot.oral_start_time })
      }
    }
    return chips
  }, [dayModalDate, subjects])

  const rangeLabel = `${windowStart.format('DD.MM.YYYY')} – ${windowEnd.format('DD.MM.YYYY')}`

  const sectionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (item.current_class_level && item.current_section) {
        set.add(`${item.current_class_level}/${item.current_section}`)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
  }, [items])

  const subjectFilterOptions = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (listSubjectLevel && item.subject_class_level !== listSubjectLevel) continue
      set.add(item.subject_name)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [items, listSubjectLevel])

  const listFiltersActive =
    listQuery.trim() !== '' || !!listSection || !!listSubjectLevel || !!listSubject || listDate !== 'all'

  const filteredItems = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase('tr-TR')
    return items.filter((item) => {
      if (listSection) {
        const section =
          item.current_class_level && item.current_section
            ? `${item.current_class_level}/${item.current_section}`
            : ''
        if (section !== listSection) return false
      }
      if (listSubjectLevel && item.subject_class_level !== listSubjectLevel) return false
      if (listSubject && item.subject_name !== listSubject) return false
      const dated = !!(item.exam_date || item.oral_exam_date)
      if (listDate === 'dated' && !dated) return false
      if (listDate === 'undated' && dated) return false
      if (!q) return true
      const name = (item.Student
        ? `${item.Student.first_name} ${item.Student.last_name}`
        : item.student_name
      ).toLocaleLowerCase('tr-TR')
      return name.includes(q) || item.student_number.toLocaleLowerCase('tr-TR').includes(q)
    })
  }, [items, listQuery, listSection, listSubjectLevel, listSubject, listDate])

  const clearListFilters = () => {
    setListQuery('')
    setListSection(null)
    setListSubjectLevel(null)
    setListSubject(null)
    setListDate('all')
  }

  const studentColumns: ColumnsType<ResponsibilityExamItem> = [
    { title: 'No', dataIndex: 'student_number', width: 80 },
    {
      title: 'Ad Soyad',
      dataIndex: 'student_name',
      render: (_, r) =>
        r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : r.student_name,
    },
    {
      title: 'Şube',
      key: 'class',
      width: 80,
      render: (_, r) =>
        r.current_class_level && r.current_section
          ? `${r.current_class_level}/${r.current_section}`
          : '—',
    },
    {
      title: 'Sorumlu ders',
      key: 'subject',
      render: (_, r) => sorumlulukSubjectLabel(r),
    },
    {
      title: 'Sınav tarihi',
      dataIndex: 'exam_date',
      width: 120,
      render: (v: string | null, row) => {
        const written = v ? dayjs(v).format('DD.MM.YYYY') : '—'
        if (!row.oral_exam_date) return written
        return `${written} / sözlü ${dayjs(row.oral_exam_date).format('DD.MM.YYYY')}`
      },
    },
  ]

  if (loading && items.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space wrap>
          {canCreate && (
            <>
              <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Excel’den içe aktar
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                Kayıt ekle
              </Button>
            </>
          )}
          <Radio.Group
            value={mode}
            onChange={(e) => {
              setMode(e.target.value)
              if (e.target.value === 'otomatik') setSelectedKey(null)
            }}
            optionType="button"
            buttonStyle="solid"
            disabled={items.length === 0}
            options={[
              { value: 'manuel', label: 'Manuel yerleştir' },
              { value: 'otomatik', label: 'Otomatik program oluştur' },
            ]}
          />
        </Space>
        <Space wrap>
          <Select
            value={exportFormat}
            onChange={setExportFormat}
            style={{ width: 110 }}
            options={[
              { value: 'xlsx', label: 'Excel' },
              { value: 'pdf', label: 'PDF' },
              { value: 'jpeg', label: 'JPEG' },
            ]}
          />
          <Button
            icon={<DownloadOutlined />}
            loading={submitting}
            disabled={items.length === 0}
            onClick={() => void onExport()}
          >
            Dışa Aktar
          </Button>
          <Button icon={<DownloadOutlined />} disabled={subjects.length === 0} onClick={downloadDutyReport}>
            Görev sayıları
          </Button>
          {canDelete && items.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
              Toplu sil ({items.length})
            </Button>
          )}
        </Space>
      </Space>

      {items.length === 0 ? (
        <Empty
          description="MEBBİS’ten «Öğrencilerin Sorumlu Olduğu Dersler» Excel’ini yükleyin; ardından dersleri takvime yerleştirin."
        >
          {canCreate && (
            <Space>
              <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Excel yükle
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                Kayıt ekle
              </Button>
            </Space>
          )}
        </Empty>
      ) : (
        <>
          {mode === 'manuel' && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Sorumlu olunan bir dersi seçin, ardından takvimde güne tıklayarak tüm öğrenciler için
              sınavı tarihlendirin. Takvimdeki dersi basılı tutup başka güne sürükleyebilirsiniz. Saat,
              gündeki «Saat ekle» ile ya da kartın saatiyle girilir. Kartın sağındaki çarpı o dersi günden
              kaldırır. Renk, sorumlu olunan sınıf seviyesini gösterir.
            </Typography.Paragraph>
          )}

          {mode === 'otomatik' && (
            <Space direction="vertical" size={8} style={{ marginBottom: 16, width: '100%' }}>
              <Space wrap>
                <DatePicker.RangePicker
                  value={autoRange}
                  onChange={(v) => setAutoRange(v as [Dayjs, Dayjs] | null)}
                  format="DD.MM.YYYY"
                />
                <Checkbox
                  checked={autoSkipTime}
                  onChange={(e) => setAutoSkipTime(e.target.checked)}
                >
                  Saat bilgisi girmeyeceğim
                </Checkbox>
                {!autoSkipTime && (
                  <TimePicker
                    value={autoStartTime}
                    onChange={setAutoStartTime}
                    format="HH:mm"
                    minuteStep={5}
                    placeholder="Sınav saati"
                  />
                )}
                {(canCreate || canUpdate) && (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={submitting}
                    onClick={() => void onAutoGenerate()}
                  >
                    Otomatik Oluştur
                  </Button>
                )}
              </Space>
              <Typography.Text type="secondary">
                Dersler hafta içi günlere dağıtılır; mümkün olduğunca aynı öğrencinin iki sınavı ayrı
                günlere konur. Saat işaretlenmezse sınavlar tarihsiz-saatli kalır, sadece tarih atanır.
              </Typography.Text>
            </Space>
          )}

          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Sorumlu olunan dersler ({scheduledCount}/{subjects.length} tarihlendi · {studentCount}{' '}
              öğrenci)
            </Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classLevels.map((level) => {
                const list = subjects.filter((s) => s.subject_class_level === level)
                const color = levelColor(level)
                return (
                  <div key={level}>
                    <Typography.Text
                      style={{ fontSize: 12, fontWeight: 700, color, display: 'block', marginBottom: 6 }}
                    >
                      {/^\d+$/.test(level) ? `${level}. sınıf` : level}
                    </Typography.Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {list.map((s) => {
                        const active = selectedKey === s.key
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => {
                              if (mode !== 'manuel' || (!canCreate && !canUpdate)) return
                              setSelectedKey(active ? null : s.key)
                            }}
                            style={{
                              cursor: mode === 'manuel' && (canCreate || canUpdate) ? 'pointer' : 'default',
                              background: active ? color : token.colorFillSecondary,
                              color: active ? '#fff' : token.colorText,
                              border: `1px solid ${active ? color : token.colorBorderSecondary}`,
                              borderLeft: `3px solid ${color}`,
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 12,
                              lineHeight: 1.3,
                              opacity: s.exam_date && !active ? 0.7 : 1,
                            }}
                          >
                            <span style={{ display: 'block' }}>
                              {s.subject_name}
                              {s.exam_date ? ' ✓' : ''}
                              {s.oral_exam_date ? ' sözlü ✓' : ''}
                              <span style={{ marginLeft: 6, opacity: 0.75 }}>{s.student_count}</span>
                            </span>
                            <span style={{ display: 'block', fontSize: 11, opacity: 0.85 }}>
                              {suggestedName(s)
                                ? `${s.committee_members?.some((member) => member.role === 'uye') ? 'Üye' : 'Öneri'}: ${suggestedName(s)}`
                                : 'Önerilen öğretmen yok'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {mode === 'manuel' && selectedSubject && (
              <Typography.Text style={{ display: 'block', marginTop: 8 }} type="success">
                Seçili: {sorumlulukSubjectLabel(selectedSubject)} — takvimde bir güne tıklayın
              </Typography.Text>
            )}
          </div>

          <Spin spinning={loading || submitting}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Button
                icon={<LeftOutlined />}
                onClick={() => setWindowStart((d) => d.subtract(14, 'day'))}
              >
                Önceki 2 hafta
              </Button>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {rangeLabel}
              </Typography.Title>
              <Button onClick={() => setWindowStart((d) => d.add(14, 'day'))}>
                Sonraki 2 hafta <RightOutlined />
              </Button>
            </div>

            <div
              ref={gridRef}
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 12,
                overflow: 'hidden',
                background: token.colorBgContainer,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  background: token.colorFillAlter,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {DAY_NAMES.map((name, index) => (
                  <div
                    key={name}
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 13,
                      color: index >= 5 ? token.colorTextTertiary : token.colorTextSecondary,
                      borderRight: index < 6 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
              {weeks.map((week, weekIndex) => (
                <div
                  key={week[0]?.format('YYYY-MM-DD') || weekIndex}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    borderTop: weekIndex ? `1px solid ${token.colorBorderSecondary}` : undefined,
                  }}
                >
                  {week.map((day, dayIndex) => {
                    const dateStr = day.format('YYYY-MM-DD')
                    const isWeekend = day.day() === 0 || day.day() === 6
                    const isToday = day.isSame(dayjs(), 'day')
                    const canDrop = mode === 'manuel' && !!selectedSubject && (canCreate || canUpdate)
                    const groups = classLevels
                      .map((level) => ({
                        level,
                        chips: subjectsByDateLevel.get(`${dateStr}|${level}`) || [],
                      }))
                      .filter((g) => g.chips.length > 0)
                    const examCount = groups.reduce((n, g) => n + g.chips.length, 0)

                    return (
                      <div
                        key={dateStr}
                        onClick={() => onSelectDay(day)}
                        onDragOver={(event) => {
                          if (!(canCreate || canUpdate)) return
                          event.preventDefault()
                          setDragOverDate(dateStr)
                        }}
                        onDragLeave={() => setDragOverDate((current) => (current === dateStr ? null : current))}
                        onDrop={(event) => {
                          if (!(canCreate || canUpdate)) return
                          event.preventDefault()
                          event.stopPropagation()
                          setDragOverDate(null)
                          const raw = event.dataTransfer.getData('text/plain')
                          const sep = raw.lastIndexOf('|')
                          const key = sep >= 0 ? raw.slice(0, sep) : ''
                          const kind = sep >= 0 ? raw.slice(sep + 1) : ''
                          if (kind !== 'yazili' && kind !== 'sozlu') return
                          const slot = subjects.find((item) => item.key === key)
                          if (!slot) return
                          void placeSubjectOnDate(slot, dateStr, kind)
                        }}
                        style={{
                          minHeight: 168,
                          padding: 8,
                          cursor: 'pointer',
                          verticalAlign: 'top',
                          background:
                            dragOverDate === dateStr
                              ? token.colorPrimaryBg
                              : isWeekend
                                ? token.colorFillQuaternary
                                : token.colorBgContainer,
                          borderRight: dayIndex < 6 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                          boxShadow: canDrop || dragOverDate === dateStr ? `inset 0 0 0 2px ${token.colorPrimary}` : undefined,
                          outline: isToday ? `2px solid ${token.colorPrimary}` : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 16,
                              color: isToday ? token.colorPrimary : token.colorText,
                            }}
                          >
                            {day.format('D')}
                          </span>
                          {(canCreate || canUpdate) ? (
                            <Popover
                              trigger="click"
                              open={dayTimeTarget === dateStr}
                              onOpenChange={(open) => {
                                setDayTimeTarget(open ? dateStr : null)
                                if (open) setDraftTime(null)
                              }}
                              content={
                                <Space onClick={(event) => event.stopPropagation()}>
                                  <TimePicker
                                    value={draftTime}
                                    onChange={setDraftTime}
                                    format="HH:mm"
                                    minuteStep={5}
                                    placeholder="Saat"
                                  />
                                  <Button size="small" type="primary" onClick={() => void applyDayTime(dateStr)}>
                                    Kaydet
                                  </Button>
                                </Space>
                              }
                            >
                              <button
                                type="button"
                                onClick={(event) => event.stopPropagation()}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: token.colorPrimary,
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  padding: 0,
                                }}
                              >
                                Saat ekle
                              </button>
                            </Popover>
                          ) : (
                            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                              {examCount > 0 ? `${examCount} ders` : day.format('MMM')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {groups.map((group) => (
                            <div key={group.level}>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: 0.3,
                                  color: levelColor(group.level),
                                  marginBottom: 3,
                                }}
                              >
                                {/^\d+$/.test(group.level) ? `${group.level}. sınıf` : group.level}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {group.chips.map((chip) => {
                                  const s = chip.slot
                                  const kindLabel = chip.kind === 'sozlu' ? 'Sözlü' : isDualSubject(s.subject_name) ? 'Yazılı' : ''
                                  const teacherLine = suggestedName(s)
                                  return (
                                  <div
                                    key={`${s.key}|${chip.kind}`}
                                    draggable={canUpdate || canCreate}
                                    title={`${sorumlulukSubjectLabel(s)} — ${s.student_count} öğrenci — sürükleyerek günü değiştirin`}
                                    onDragStart={(event) => {
                                      dragHappened.current = true
                                      event.stopPropagation()
                                      event.dataTransfer.setData('text/plain', `${s.key}|${chip.kind}`)
                                      event.dataTransfer.effectAllowed = 'move'
                                    }}
                                    onDragEnd={() => {
                                      setDragOverDate(null)
                                      window.setTimeout(() => {
                                        dragHappened.current = false
                                      }, 0)
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      if (dragHappened.current || !canUpdate) return
                                      setCommitteeDate(dateStr)
                                      setCommitteeSlot(s)
                                    }}
                                    style={{
                                      background: softBg(levelColor(s.subject_class_level)),
                                      color: token.colorText,
                                      borderLeft: `3px solid ${levelColor(s.subject_class_level)}`,
                                      borderRadius: 4,
                                      padding: '3px 6px',
                                      fontSize: 12,
                                      lineHeight: 1.3,
                                      cursor: canUpdate ? 'grab' : 'default',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                      }}
                                    >
                                      {s.subject_name}
                                      {kindLabel ? ` (${kindLabel})` : ''}
                                    </span>
                                    <span style={{ color: token.colorTextSecondary, flexShrink: 0 }}>
                                      {s.student_count}
                                    </span>
                                    {(canUpdate || canDelete) && (
                                      <button
                                        type="button"
                                        aria-label={`${s.subject_name} dersini bu günden kaldır`}
                                        title="Bu günden kaldır"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          modal.confirm({
                                            title: 'Dersi günden kaldır',
                                            content: `${sorumlulukSubjectLabel(s)} (${s.student_count} öğrenci) ${day.format('DD.MM.YYYY')} tarihinden kaldırılacak.`,
                                            okText: 'Kaldır',
                                            okButtonProps: { danger: true },
                                            cancelText: 'Vazgeç',
                                            onOk: () => placeSubjectOnDate(s, null, chip.kind),
                                          })
                                        }}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          color: token.colorTextSecondary,
                                          cursor: 'pointer',
                                          padding: 0,
                                          lineHeight: 1,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <CloseOutlined style={{ fontSize: 10 }} />
                                      </button>
                                    )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                                        {teacherLine ? teacherLine : 'Öğretmen yok'}
                                      </span>
                                      {(canCreate || canUpdate) && (
                                        <Popover
                                          trigger="click"
                                          open={timeTarget?.key === s.key && timeTarget.kind === chip.kind}
                                          onOpenChange={(open) => {
                                            setTimeTarget(open ? { key: s.key, kind: chip.kind } : null)
                                            setDraftTime(parseClock(chip.time))
                                          }}
                                          content={
                                            <Space onClick={(event) => event.stopPropagation()}>
                                              <TimePicker
                                                value={draftTime}
                                                onChange={setDraftTime}
                                                format="HH:mm"
                                                minuteStep={5}
                                              />
                                              <Button
                                                size="small"
                                                type="primary"
                                                onClick={() => void setExamTime(s, chip.kind, draftTime ? draftTime.format('HH:mm') : null)}
                                              >
                                                Kaydet
                                              </Button>
                                            </Space>
                                          }
                                        >
                                          <button
                                            type="button"
                                            onClick={(event) => event.stopPropagation()}
                                            style={{
                                              border: 'none',
                                              background: 'transparent',
                                              color: token.colorPrimary,
                                              cursor: 'pointer',
                                              fontSize: 11,
                                              padding: 0,
                                              flexShrink: 0,
                                            }}
                                          >
                                            <ClockCircleOutlined /> {chip.time || 'Saat'}
                                          </button>
                                        </Popover>
                                      )}
                                    </div>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </Spin>

          <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>
            Öğrenci listesi ({filteredItems.length}/{items.length})
          </Typography.Title>
          <FilterBar>
            <Input
              allowClear
              placeholder="No veya ad soyad"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              allowClear
              placeholder="Şube"
              value={listSection ?? undefined}
              onChange={(v) => setListSection(v ?? null)}
              style={{ width: 120 }}
              options={sectionOptions.map((s) => ({ value: s, label: s }))}
            />
            <Select
              allowClear
              placeholder="Sorumlu sınıf"
              value={listSubjectLevel ?? undefined}
              onChange={(v) => {
                setListSubjectLevel(v ?? null)
                setListSubject(null)
              }}
              style={{ width: 140 }}
              options={classLevels.map((level) => ({
                value: level,
                label: /^\d+$/.test(level) ? `${level}. sınıf` : level,
              }))}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Ders"
              value={listSubject ?? undefined}
              onChange={(v) => setListSubject(v ?? null)}
              style={{ width: 220 }}
              options={subjectFilterOptions.map((name) => ({ value: name, label: name }))}
            />
            <Select
              value={listDate}
              onChange={setListDate}
              style={{ width: 150 }}
              options={[
                { value: 'all', label: 'Tüm tarihler' },
                { value: 'dated', label: 'Tarihlenmiş' },
                { value: 'undated', label: 'Tarihsiz' },
              ]}
            />
            <ClearFiltersButton active={listFiltersActive} onClick={clearListFilters} />
          </FilterBar>
          <Table
            size="small"
            rowKey="id"
            columns={studentColumns}
            dataSource={filteredItems}
            pagination={tablePagination(20)}
            locale={{ emptyText: listFiltersActive ? 'Filtreye uyan kayıt yok' : 'Kayıt yok' }}
          />
        </>
      )}

      <Modal
        title={dayModalDate ? `Sınavlar — ${dayjs(dayModalDate).format('DD.MM.YYYY')}` : 'Sınavlar'}
        open={!!dayModalDate}
        onCancel={() => setDayModalDate(null)}
        footer={null}
        destroyOnHidden
        width={640}
      >
        {dayModalSlots.length === 0 ? (
          <Empty description="Bu günde sorumluluk sınavı yok" />
        ) : (
          <List
            size="small"
            dataSource={dayModalSlots}
            renderItem={(chip) => {
              const slot = chip.slot
              const students =
                studentsBySubjectDate.get(`${dayModalDate}|${slot.key}`) || []
              const kindLabel = chip.kind === 'sozlu' ? 'Sözlü' : 'Yazılı'
              return (
                <List.Item
                  actions={
                    canUpdate || canDelete
                      ? [
                          <Button
                            key="rm"
                            size="small"
                            type="link"
                            danger
                            onClick={() => void placeSubjectOnDate(slot, null, chip.kind)}
                          >
                            Günden kaldır
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: levelColor(slot.subject_class_level),
                          display: 'inline-block',
                        }}
                      />
                      <span>
                        {sorumlulukSubjectLabel(slot)} ({kindLabel}
                        {chip.time ? ` ${chip.time}` : ''})
                      </span>
                      <Typography.Text type="secondary">{students.length} öğrenci</Typography.Text>
                    </Space>
                    <Space wrap size={8}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Komisyon: {committeeSummary(slot) || 'atanmadı'}
                      </Typography.Text>
                      {canUpdate && (
                        <Button
                          size="small"
                          onClick={() => {
                            setCommitteeDate(dayModalDate)
                            setCommitteeSlot(slot)
                          }}
                        >
                          Komisyon belirle
                        </Button>
                      )}
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {students
                        .slice(0, 8)
                        .map((s) => s.student_name)
                        .join(', ')}
                      {students.length > 8 ? ` +${students.length - 8}` : ''}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )
            }}
          />
        )}
      </Modal>

      <SorumlulukExamCommitteeModal
        open={!!committeeSlot}
        slot={committeeSlot}
        examDate={committeeDate}
        teachers={committeeTeachers}
        principalName={principalName}
        principalTeacherId={principalTeacherId}
        languages={schoolLanguages}
        slots={subjects}
        onCancel={() => {
          setCommitteeSlot(null)
          setCommitteeDate(null)
        }}
        onSaved={() => void load()}
      />
      <SorumlulukExamAddModal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onCreated={() => void load()}
      />
      <SorumlulukExamImportModal
        open={importOpen}
        schoolId={activeSchoolId}
        hasExisting={items.length > 0}
        onCancel={() => setImportOpen(false)}
        onImported={() => void load()}
      />
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Sorumluluk sınavlarını toplu sil"
        description={`İçe aktarılan ${items.length} kayıt silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </div>
  )
}
