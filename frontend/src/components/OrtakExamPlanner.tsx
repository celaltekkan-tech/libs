import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Empty,
  Input,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  theme,
  Typography,
} from 'antd'
import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/tr'
import isoWeek from 'dayjs/plugin/isoWeek'
import { toJpeg } from 'html-to-image'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listAcademicYears, updateAcademicYear } from '../api/academicYears'
import {
  createExam,
  createExamPeriod,
  deleteExam,
  deleteExamPeriod,
  exportExams,
  listExamPeriods,
  listExams,
  updateExam,
  updateExamPeriod,
  type ExamPeriod,
} from '../api/exams'
import type { AcademicYear } from '../types/academicYear'
import { listScheduleEntries, listScheduleTeachers } from '../api/schedule'
import type { ScheduleTeacherOption } from '../api/schedule'
import { listSubjects } from '../api/subjects'
import { ApiError, getErrorMessage } from '../api/client'
import type { Exam } from '../types/exam'
import { classroomLabel } from '../types/classroom'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { TypedPhraseConfirmModal } from './TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'
import { useObjectColors } from '../theme/ObjectPaletteContext'

dayjs.extend(isoWeek)
dayjs.locale('tr')

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MAX_EXAMS_PER_LEVEL = 4

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

function sortClassLevels(levels: string[]): string[] {
  return [...levels].sort((a, b) => {
    const na = Number.parseInt(a, 10)
    const nb = Number.parseInt(b, 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
    return a.localeCompare(b, 'tr')
  })
}

export interface ScheduleSubjectSlot {
  subject_id: number
  subject_name: string
  difficulty_level: string | null
  classroom_ids: number[]
  classroom_labels: string[]
  /** Sınıf seviyesi → o seviyeye ait şube id'leri */
  classroomsByLevel: Record<string, number[]>
}

type PlannerExportFormat = ExportFormat | 'jpeg'

interface OrtakExamPlannerProps {
  canCreate: boolean
  canDelete: boolean
}

function startOfTwoWeekWindow(d: Dayjs): Dayjs {
  return d.startOf('isoWeek')
}

function formatTr(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY')
}

function dateInPeriod(dateStr: string, period: { start_date: string; end_date: string } | null): boolean {
  if (!period) return false
  const start = period.start_date.slice(0, 10)
  const end = period.end_date.slice(0, 10)
  return dateStr >= start && dateStr <= end
}

export function OrtakExamPlanner({ canCreate, canDelete }: OrtakExamPlannerProps) {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const canEditYear = hasPermission('academic_years.update')
  const { token } = theme.useToken()
  const colors = useObjectColors()
  const gridRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<'manuel' | 'otomatik'>('manuel')
  const [windowStart, setWindowStart] = useState<Dayjs>(() => startOfTwoWeekWindow(dayjs()))
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<ScheduleSubjectSlot[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [periods, setPeriods] = useState<ExamPeriod[]>([])
  const [periodRange, setPeriodRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<PlannerExportFormat>('xlsx')
  const [scheduleTeachers, setScheduleTeachers] = useState<ScheduleTeacherOption[]>([])

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
      const [examRows, scheduleRows, subjectRows, scheduleTeacherRows, yearRows, periodRows] = await Promise.all([
        listExams(),
        listScheduleEntries().catch(() => []),
        listSubjects({ is_active: true }).catch(() => []),
        listScheduleTeachers().catch(() => []),
        listAcademicYears().catch(() => []),
        listExamPeriods('ortak').catch(() => []),
      ])

      setExams(examRows.filter((e) => e.exam_type === 'ortak'))
      setScheduleTeachers(scheduleTeacherRows)
      setAcademicYears(yearRows)
      setAcademicYear(yearRows.find((year) => year.is_current) || null)
      setPeriods(periodRows)

      const difficultyById = new Map(subjectRows.map((s) => [s.id, s.difficulty_level]))

      const bySubject = new Map<number, ScheduleSubjectSlot>()
      for (const row of scheduleRows) {
        const sid = row.subject_id
        const name = row.Subject?.name || `Ders #${sid}`
        const existing = bySubject.get(sid)
        const label = row.Classroom
          ? classroomLabel(row.Classroom)
          : `Sınıf #${row.classroom_id}`
        const level = row.Classroom?.class_level || '?'
        if (existing) {
          if (!existing.classroom_ids.includes(row.classroom_id)) {
            existing.classroom_ids.push(row.classroom_id)
            existing.classroom_labels.push(label)
          }
          const levelList = existing.classroomsByLevel[level] || []
          if (!levelList.includes(row.classroom_id)) {
            existing.classroomsByLevel[level] = [...levelList, row.classroom_id]
          }
        } else {
          bySubject.set(sid, {
            subject_id: sid,
            subject_name: name,
            difficulty_level: difficultyById.get(sid) ?? null,
            classroom_ids: [row.classroom_id],
            classroom_labels: [label],
            classroomsByLevel: { [level]: [row.classroom_id] },
          })
        }
      }
      setSubjects(
        Array.from(bySubject.values()).sort((a, b) =>
          a.subject_name.localeCompare(b.subject_name, 'tr'),
        ),
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => exams.map((e) => e.id),
    deleteOne: (id) => deleteExam(Number(id)),
    noun: 'ortak sınav kaydı',
    reload: () => void load(),
    message,
  })

  const examsByDate = useMemo(() => {
    const map = new Map<string, Exam[]>()
    for (const exam of exams) {
      const list = map.get(exam.exam_date) || []
      list.push(exam)
      map.set(exam.exam_date, list)
    }
    return map
  }, [exams])

  const classLevels = useMemo(() => {
    const set = new Set<string>()
    for (const s of subjects) {
      for (const level of Object.keys(s.classroomsByLevel)) set.add(level)
    }
    for (const e of exams) {
      if (e.Classroom?.class_level) set.add(e.Classroom.class_level)
    }
    return sortClassLevels(Array.from(set))
  }, [subjects, exams])

  /** Tarih + seviye → ders bazında tekilleştirilmiş sınavlar */
  const subjectsByDateLevel = useMemo(() => {
    const map = new Map<string, Exam[]>()
    for (const exam of exams) {
      const level = exam.Classroom?.class_level
      if (!level) continue
      const key = `${exam.exam_date}|${level}`
      const list = map.get(key) || []
      if (!list.some((x) => x.subject_id === exam.subject_id)) list.push(exam)
      map.set(key, list)
    }
    return map
  }, [exams])

  const activePeriod = periods.find((period) => period.is_active) || null

  useEffect(() => {
    if (!activePeriod) return
    const start = dayjs(activePeriod.start_date)
    const end = dayjs(activePeriod.end_date)
    const today = dayjs()
    const focus = today.isBefore(start, 'day') || today.isAfter(end, 'day') ? start : today
    setWindowStart(startOfTwoWeekWindow(focus))
  }, [activePeriod?.id, activePeriod?.start_date, activePeriod?.end_date])

  const placedSubjectIds = useMemo(() => {
    if (!activePeriod) return new Set<number>()
    return new Set(
      exams
        .filter((exam) => dateInPeriod(exam.exam_date.slice(0, 10), activePeriod))
        .map((exam) => exam.subject_id),
    )
  }, [exams, activePeriod])

  const selectedSubject = subjects.find((s) => s.subject_id === selectedSubjectId) || null

  const yearStart = academicYear?.start_date ? dayjs(academicYear.start_date) : null
  const yearEnd = academicYear?.end_date ? dayjs(academicYear.end_date) : null
  const yearReady = Boolean(yearStart?.isValid() && yearEnd?.isValid())

  const placeSubjectOnDate = async (slot: ScheduleSubjectSlot, dateStr: string) => {
    if (!session) return
    if (!activePeriod) {
      message.warning('Önce eğitim öğretim yılı içinde bir sınav tarihi oluşturun')
      return
    }
    if (!dateInPeriod(dateStr, activePeriod)) {
      message.warning('Ders sınavı yalnızca aktif sınav tarihi aralığına konabilir')
      return
    }
    if (slot.classroom_ids.length === 0) {
      message.warning('Bu ders için ders programında sınıf bulunamadı')
      return
    }

    const levels = Object.keys(slot.classroomsByLevel)
    const blockedLevels: string[] = []
    const allowedClassroomIds: number[] = []

    for (const level of levels) {
      const existing = subjectsByDateLevel.get(`${dateStr}|${level}`) || []
      const alreadyPlaced = existing.some((e) => e.subject_id === slot.subject_id)
      if (!alreadyPlaced && existing.length >= MAX_EXAMS_PER_LEVEL) {
        blockedLevels.push(level)
        continue
      }
      allowedClassroomIds.push(...(slot.classroomsByLevel[level] || []))
    }

    if (allowedClassroomIds.length === 0) {
      message.warning(
        `Bu tarihte sınıf seviyesi başına en fazla ${MAX_EXAMS_PER_LEVEL} sınav yerleştirilebilir` +
          (blockedLevels.length ? ` (${blockedLevels.join(', ')})` : ''),
      )
      return
    }

    setSubmitting(true)
    try {
      let created = 0
      let skipped = 0
      let lastWarning: string | null = null
      for (const classroomId of allowedClassroomIds) {
        try {
          const { warning } = await createExam(session.user.tenant_id, {
            classroom_id: classroomId,
            subject_id: slot.subject_id,
            exam_type: 'ortak',
            exam_date: dateStr,
            duration_minutes: 40,
          })
          created += 1
          if (warning) lastWarning = warning
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            skipped += 1
          } else {
            throw err
          }
        }
      }
      if (created > 0) {
        message.success(
          `${slot.subject_name}: ${created} sınıf için ${dateStr} tarihine yerleştirildi` +
            (skipped ? ` (${skipped} çakışma atlandı)` : '') +
            (blockedLevels.length
              ? ` — dolu seviye atlandı: ${blockedLevels.join(', ')}`
              : ''),
        )
      } else if (skipped > 0) {
        message.warning('Seçilen tarihte bu sınıflar için zaten sınav var')
      }
      if (lastWarning) {
        modal.warning({ title: 'Uyarı', content: lastWarning })
      }
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSelectDay = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    if (mode === 'manuel' && canCreate && selectedSubject) {
      if (!activePeriod) {
        message.warning('Önce eğitim öğretim yılı içinde bir sınav tarihi oluşturun')
        return
      }
      if (!dateInPeriod(dateStr, activePeriod)) {
        message.warning('Ders sınavı yalnızca aktif sınav tarihi aralığına konabilir')
        return
      }
      void placeSubjectOnDate(selectedSubject, dateStr)
      return
    }
    setDayModalDate(dateStr)
  }

  const canPlaceSlotOnDate = (slot: ScheduleSubjectSlot, dateStr: string) => {
    const levels = Object.keys(slot.classroomsByLevel)
    return levels.some((level) => {
      const existing = subjectsByDateLevel.get(`${dateStr}|${level}`) || []
      if (existing.some((e) => e.subject_id === slot.subject_id)) return true
      return existing.length < MAX_EXAMS_PER_LEVEL
    })
  }

  const onSelectYear = async (id: number) => {
    const year = academicYears.find((item) => item.id === id)
    if (!year || year.is_current || !canEditYear) return
    setSubmitting(true)
    try {
      await updateAcademicYear(year.id, { label: year.label, is_current: true })
      message.success(`${year.label} eğitim öğretim yılı seçildi`)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onCreatePeriod = async () => {
    if (!periodRange) {
      message.warning('Sınav tarihi aralığı seçin')
      return
    }
    setSubmitting(true)
    try {
      await createExamPeriod({
        label: periodLabel.trim() || null,
        start_date: periodRange[0].format('YYYY-MM-DD'),
        end_date: periodRange[1].format('YYYY-MM-DD'),
        exam_type: 'ortak',
      })
      setPeriodRange(null)
      setPeriodLabel('')
      message.success('Sınav tarihi oluşturuldu')
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onActivatePeriod = async (period: ExamPeriod) => {
    if (period.is_active || !canCreate) return
    try {
      await updateExamPeriod(period.id, { is_active: true })
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDeletePeriod = (period: ExamPeriod) => {
    modal.confirm({
      title: 'Sınav tarihini sil',
      content: `${formatTr(period.start_date)} – ${formatTr(period.end_date)} aralığı silinecek. Bu aralığa konmuş ders sınavları da silinir.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          const deleted = await deleteExamPeriod(period.id)
          message.success(
            deleted > 0
              ? `Sınav tarihi ve ${deleted} sınav kaydı silindi`
              : 'Sınav tarihi silindi',
          )
          await load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onAutoGenerate = async () => {
    if (!session || !activePeriod) {
      message.warning('Önce eğitim öğretim yılı içinde bir sınav tarihi oluşturun')
      return
    }
    const pending = subjects.filter((s) => !placedSubjectIds.has(s.subject_id))
    if (pending.length === 0) {
      message.info('Yerleştirilecek ders kalmadı (ders programından gelen tüm dersler takvimde)')
      return
    }

    const difficultyRank = (d: string | null) => (d === 'zor' ? 0 : d === 'orta' ? 1 : 2)
    const ordered = [...pending].sort(
      (a, b) =>
        difficultyRank(a.difficulty_level) - difficultyRank(b.difficulty_level) ||
        a.subject_name.localeCompare(b.subject_name, 'tr'),
    )

    const weekdays: string[] = []
    let cursor = dayjs(activePeriod.start_date).startOf('day')
    const end = dayjs(activePeriod.end_date).startOf('day')
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const dow = cursor.day()
      if (dow >= 1 && dow <= 5) weekdays.push(cursor.format('YYYY-MM-DD'))
      cursor = cursor.add(1, 'day')
    }

    if (weekdays.length === 0) {
      message.warning('Seçilen aralıkta hafta içi gün yok')
      return
    }

    // Simüle edilmiş doluluk: tarih|seviye → subject_id set
    const occupancy = new Map<string, Set<number>>()
    for (const [key, list] of subjectsByDateLevel) {
      occupancy.set(key, new Set(list.map((e) => e.subject_id)))
    }

    const hardDates = new Set<string>()
    for (const exam of exams) {
      if (exam.Subject?.difficulty_level === 'zor') hardDates.add(exam.exam_date)
    }

    const assignments: { slot: ScheduleSubjectSlot; date: string }[] = []

    for (const slot of ordered) {
      const preferHardGap = slot.difficulty_level === 'zor'
      let chosen: string | null = null

      for (const d of weekdays) {
        if (preferHardGap) {
          const prev = dayjs(d).subtract(1, 'day').format('YYYY-MM-DD')
          const next = dayjs(d).add(1, 'day').format('YYYY-MM-DD')
          if (hardDates.has(prev) || hardDates.has(next)) continue
        }

        const levels = Object.keys(slot.classroomsByLevel)
        const fits = levels.every((level) => {
          const key = `${d}|${level}`
          const set = occupancy.get(key) || new Set<number>()
          if (set.has(slot.subject_id)) return true
          return set.size < MAX_EXAMS_PER_LEVEL
        })
        if (!fits) continue
        chosen = d
        break
      }

      if (!chosen) {
        for (const d of weekdays) {
          const levels = Object.keys(slot.classroomsByLevel)
          const fits = levels.every((level) => {
            const key = `${d}|${level}`
            const set = occupancy.get(key) || new Set<number>()
            if (set.has(slot.subject_id)) return true
            return set.size < MAX_EXAMS_PER_LEVEL
          })
          if (fits) {
            chosen = d
            break
          }
        }
      }

      if (!chosen) continue

      for (const level of Object.keys(slot.classroomsByLevel)) {
        const key = `${chosen}|${level}`
        const set = occupancy.get(key) || new Set<number>()
        set.add(slot.subject_id)
        occupancy.set(key, set)
      }
      if (slot.difficulty_level === 'zor') hardDates.add(chosen)
      assignments.push({ slot, date: chosen })
    }

    if (assignments.length === 0) {
      message.warning(
        `Uygun gün bulunamadı (sınıf seviyesi başına günde en fazla ${MAX_EXAMS_PER_LEVEL} sınav)`,
      )
      return
    }

    modal.confirm({
      title: 'Otomatik ortak sınav programı',
      content: `${assignments.length} ders, seçilen aralıktaki hafta içi günlere yerleştirilecek (seviye başına günde en fazla ${MAX_EXAMS_PER_LEVEL}). Devam edilsin mi?`,
      okText: 'Oluştur',
      cancelText: 'Vazgeç',
      onOk: async () => {
        setSubmitting(true)
        try {
          let created = 0
          for (const { slot, date } of assignments) {
            for (const classroomId of slot.classroom_ids) {
              try {
                await createExam(session.user.tenant_id, {
                  classroom_id: classroomId,
                  subject_id: slot.subject_id,
                  exam_type: 'ortak',
                  exam_date: date,
                  duration_minutes: 40,
                })
                created += 1
              } catch {
                // çakışmaları atla
              }
            }
          }
          message.success(`${created} sınav kaydı oluşturuldu`)
          await load()
        } catch (err) {
          message.error(getErrorMessage(err))
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const onDeleteExam = (exam: Exam) => {
    modal.confirm({
      title: 'Sınavı sil',
      content: `${exam.Subject?.name || 'Ders'} — ${exam.exam_date} kaydı silinsin mi?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteExam(exam.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onDeleteDaySubject = async (dateStr: string, subjectId: number) => {
    const rows = (examsByDate.get(dateStr) || []).filter((e) => e.subject_id === subjectId)
    if (rows.length === 0) return
    modal.confirm({
      title: 'Dersi günden kaldır',
      content: `${rows[0].Subject?.name || 'Ders'} için bu tarihteki ${rows.length} sınıf kaydı silinecek.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          for (const row of rows) await deleteExam(row.id)
          message.success('Kaldırıldı')
          setDayModalDate(null)
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onAssignTeacher = async (exam: Exam, teacherId: number | null) => {
    try {
      await updateExam(exam.id, { teacher_id: teacherId })
      message.success('Öğretmen güncellendi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const teachersForSubject = (subjectId: number) => {
    const fromSchedule = scheduleTeachers.filter((t) => t.subject_ids.includes(subjectId))
    if (fromSchedule.length > 0) return fromSchedule
    return scheduleTeachers
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
    downloadBlob(blob, `ortak-sinav-programi-${windowStart.format('YYYYMMDD')}.jpeg`)
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      if (exportFormat === 'jpeg') {
        await onExportJpeg()
      } else {
        const blob = await exportExams({
          format: exportFormat,
          start_date: windowStart.format('YYYY-MM-DD'),
          end_date: windowEnd.format('YYYY-MM-DD'),
        })
        downloadBlob(blob, exportFilename('ortak-sinav-programi', exportFormat))
      }
      message.success('Dışa aktarma indirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const dayModalExams = dayModalDate ? examsByDate.get(dayModalDate) || [] : []
  const rangeLabel = `${windowStart.format('DD.MM.YYYY')} – ${windowEnd.format('DD.MM.YYYY')}`

  if (loading && subjects.length === 0 && exams.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Radio.Group
          value={mode}
          onChange={(e) => {
            setMode(e.target.value)
            if (e.target.value === 'otomatik') setSelectedSubjectId(null)
          }}
          optionType="button"
          buttonStyle="solid"
          options={[
            { value: 'manuel', label: 'Manuel yerleştir' },
            { value: 'otomatik', label: 'Otomatik program oluştur' },
          ]}
        />
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
          <Button icon={<DownloadOutlined />} loading={submitting} onClick={() => void onExport()}>
            Dışa Aktar
          </Button>
          {canDelete && exams.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
              Toplu sil ({exams.length})
            </Button>
          )}
        </Space>
      </Space>

      {mode === 'manuel' && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Önce eğitim öğretim yılı içinde bir sınav tarihi oluşturun. Ardından dersi seçip bu aralıktaki
          bir güne tıklayın. Her sınıf seviyesine günde en fazla {MAX_EXAMS_PER_LEVEL} sınav konabilir.
          Kalın kenarlık, yalnızca aktif tarih aralığına konmuş derslerde görünür.
        </Typography.Paragraph>
      )}

      {mode === 'otomatik' && (
        <Space wrap style={{ marginBottom: 16 }}>
          {canCreate && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={submitting}
              disabled={!activePeriod}
              onClick={() => void onAutoGenerate()}
            >
              Otomatik Oluştur
            </Button>
          )}
          <Typography.Text type="secondary">
            {activePeriod
              ? `Dersler ${formatTr(activePeriod.start_date)} – ${formatTr(activePeriod.end_date)} aralığındaki hafta içi günlere dağıtılır; seviye başına günde en fazla ${MAX_EXAMS_PER_LEVEL} sınav, zor dersler ardışık günlere konmaz.`
              : 'Otomatik yerleştirme için önce bir sınav tarihi oluşturun.'}
          </Typography.Text>
        </Space>
      )}

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Eğitim öğretim yılı
        </Typography.Text>
        {academicYears.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message={
              <span>
                Tanımlı eğitim öğretim yılı yok.{' '}
                <Link to="/academic-years">Eğitim öğretim yılı tanımlayın</Link>.
              </span>
            }
          />
        ) : (
          <Space wrap>
            <Select
              value={academicYear?.id}
              placeholder="Eğitim öğretim yılı seçin"
              style={{ minWidth: 200 }}
              disabled={!canEditYear}
              loading={submitting}
              onChange={(id) => void onSelectYear(id)}
              options={academicYears.map((year) => ({
                value: year.id,
                label: year.label,
              }))}
            />
            {academicYear && yearReady && yearStart && yearEnd && (
              <Typography.Text type="secondary">
                {yearStart.format('DD.MM.YYYY')} – {yearEnd.format('DD.MM.YYYY')}
              </Typography.Text>
            )}
            {academicYear && !yearReady && (
              <Typography.Text type="secondary">
                Bu yılın tarihi yok.{' '}
                <Link to="/academic-years">Eğitim öğretim yıllarından girin</Link>.
              </Typography.Text>
            )}
          </Space>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Sınav tarihleri
        </Typography.Text>
        {academicYear && !yearReady && (
          <Typography.Text type="secondary">
            Seçili eğitim öğretim yılının başlangıç ve bitiş tarihi tanımlı değil.
          </Typography.Text>
        )}
        {academicYear && yearReady && yearStart && yearEnd && (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space wrap size={[8, 8]}>
              {periods.map((period) => (
                <Tag
                  key={period.id}
                  color={period.is_active ? 'blue' : undefined}
                  onClick={() => void onActivatePeriod(period)}
                  style={{
                    cursor: canCreate && !period.is_active ? 'pointer' : 'default',
                    padding: '4px 8px',
                    fontSize: 13,
                  }}
                  closable={canDelete}
                  onClose={(event) => {
                    event.preventDefault()
                    onDeletePeriod(period)
                  }}
                >
                  {period.label ? `${period.label} · ` : ''}
                  {formatTr(period.start_date)} – {formatTr(period.end_date)}
                  {period.is_active ? ' · aktif' : ''}
                </Tag>
              ))}
            </Space>
            {canCreate && (
              <Space wrap>
                <Input
                  value={periodLabel}
                  onChange={(event) => setPeriodLabel(event.target.value)}
                  placeholder="Ad (isteğe bağlı)"
                  style={{ width: 180 }}
                  maxLength={80}
                />
                <DatePicker.RangePicker
                  value={periodRange}
                  onChange={(value) => setPeriodRange(value as [Dayjs, Dayjs] | null)}
                  format="DD.MM.YYYY"
                  disabledDate={(current) =>
                    !!current &&
                    (current.isBefore(yearStart, 'day') || current.isAfter(yearEnd, 'day'))
                  }
                />
                <Button icon={<PlusOutlined />} loading={submitting} onClick={() => void onCreatePeriod()}>
                  Tarih ekle
                </Button>
              </Space>
            )}
          </Space>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Ders programından dersler
        </Typography.Text>
        {subjects.length === 0 ? (
          <Empty
            description="Ders programında kayıt yok. Otomatik Ders Programı sayfasından programı oluşturup yayınlayın."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Space wrap size={[8, 8]}>
            {subjects.map((s) => {
              const active = selectedSubjectId === s.subject_id
              const placed = placedSubjectIds.has(s.subject_id)
              const tone = colors.swatchForId(s.subject_id)
              return (
                <Tag
                  key={s.subject_id}
                  onClick={() => {
                    if (mode !== 'manuel' || !canCreate) return
                    setSelectedSubjectId(active ? null : s.subject_id)
                  }}
                  style={{
                    cursor: mode === 'manuel' && canCreate ? 'pointer' : 'default',
                    background: active ? tone.text : tone.bg,
                    color: active ? tone.bg : tone.text,
                    borderStyle: 'solid',
                    borderWidth: placed ? 3 : 1,
                    borderColor: tone.border,
                    padding: '4px 10px',
                    fontSize: 13,
                  }}
                >
                  {s.subject_name}
                  {placed ? ' ✓' : ''}
                  <Typography.Text
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: active ? 'rgba(255,255,255,0.85)' : '#64748b',
                    }}
                  >
                    ({s.classroom_ids.length} sınıf)
                  </Typography.Text>
                </Tag>
              )
            })}
          </Space>
        )}
        {mode === 'manuel' && selectedSubject && (
          <Typography.Text style={{ display: 'block', marginTop: 8 }} type="success">
            Seçili: {selectedSubject.subject_name} — aktif tarih aralığında bir güne tıklayın
          </Typography.Text>
        )}
        {activePeriod && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Kalın kenarlık, {formatTr(activePeriod.start_date)} – {formatTr(activePeriod.end_date)} aralığına
            konmuş dersleri gösterir.
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
          <Button
            onClick={() => setWindowStart((d) => d.add(14, 'day'))}
          >
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
                const inRange = dateInPeriod(dateStr, activePeriod)
                const canDrop =
                  mode === 'manuel' &&
                  !!selectedSubject &&
                  canCreate &&
                  inRange &&
                  canPlaceSlotOnDate(selectedSubject, dateStr)
                const groups = classLevels
                  .map((level) => ({
                    level,
                    chips: subjectsByDateLevel.get(`${dateStr}|${level}`) || [],
                  }))
                  .filter((group) => group.chips.length > 0)
                const examCount = groups.reduce((n, group) => n + group.chips.length, 0)

                return (
                  <div
                    key={dateStr}
                    onClick={() => onSelectDay(day)}
                    style={{
                      minHeight: 168,
                      padding: 8,
                      cursor: 'pointer',
                      background:
                        activePeriod && !inRange
                          ? token.colorFillSecondary
                          : isWeekend
                            ? token.colorFillQuaternary
                            : token.colorBgContainer,
                      opacity: activePeriod && !inRange ? 0.55 : 1,
                      borderRight: dayIndex < 6 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                      boxShadow: canDrop ? `inset 0 0 0 2px ${token.colorPrimary}` : undefined,
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
                      <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                        {examCount > 0 ? `${examCount} ders` : day.format('MMM')}
                      </span>
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
                            <span style={{ marginLeft: 6, fontWeight: 600, color: token.colorTextTertiary }}>
                              {group.chips.length}/{MAX_EXAMS_PER_LEVEL}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {group.chips.map((exam) => {
                              const tone = colors.swatchForId(exam.subject_id)
                              const name = exam.Subject?.name || `#${exam.subject_id}`
                              return (
                                <div
                                  key={exam.subject_id}
                                  title={name}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setDayModalDate(dateStr)
                                  }}
                                  style={{
                                    background: tone.bg,
                                    color: tone.text,
                                    borderLeft: `3px solid ${tone.border}`,
                                    borderRadius: 4,
                                    padding: '3px 6px',
                                    fontSize: 12,
                                    lineHeight: 1.3,
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
                                      {name}
                                    </span>
                                    {canDelete && (
                                      <button
                                        type="button"
                                        aria-label={`${name} dersini bu günden kaldır`}
                                        title="Bu günden kaldır"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          void onDeleteDaySubject(dateStr, exam.subject_id)
                                        }}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          color: tone.text,
                                          cursor: 'pointer',
                                          padding: 0,
                                          lineHeight: 1,
                                          flexShrink: 0,
                                          opacity: 0.75,
                                        }}
                                      >
                                        <CloseOutlined style={{ fontSize: 10 }} />
                                      </button>
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

      <Modal
        title={dayModalDate ? `Sınavlar — ${dayModalDate}` : 'Sınavlar'}
        open={!!dayModalDate}
        onCancel={() => setDayModalDate(null)}
        footer={null}
        destroyOnHidden
      >
        {dayModalExams.length === 0 ? (
          <Empty description="Bu günde ortak sınav yok" />
        ) : (
          <List
            size="small"
            dataSource={dayModalExams}
            renderItem={(exam) => (
              <List.Item
                actions={
                  canDelete
                    ? [
                        <Button
                          key="del"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => onDeleteExam(exam)}
                        />,
                        <Button
                          key="rm"
                          size="small"
                          type="link"
                          danger
                          onClick={() => void onDeleteDaySubject(exam.exam_date, exam.subject_id)}
                        >
                          Dersi kaldır
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
                        background: colors.swatchForId(exam.subject_id).border,
                        display: 'inline-block',
                      }}
                    />
                    <span>{exam.Subject?.name || '—'}</span>
                    <Typography.Text type="secondary">
                      {exam.Classroom ? classroomLabel(exam.Classroom) : ''}
                    </Typography.Text>
                  </Space>
                  <Select
                    size="small"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Öğretmen (ders programından)"
                    style={{ width: '100%', maxWidth: 320 }}
                    value={exam.teacher_id ?? undefined}
                    onChange={(v) => void onAssignTeacher(exam, v ?? null)}
                    options={teachersForSubject(exam.subject_id).map((t) => ({
                      value: t.id,
                      label: `${t.first_name} ${t.last_name}`,
                    }))}
                  />
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Ortak sınavları toplu sil"
        description={`Görünen ${exams.length} ortak sınav kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </div>
  )
}
