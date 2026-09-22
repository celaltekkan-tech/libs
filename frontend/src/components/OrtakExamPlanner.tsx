import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Empty,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { toJpeg } from 'html-to-image'
import { useAuth } from '../auth/AuthContext'
import { createExam, deleteExam, exportExams, listExams, updateExam } from '../api/exams'
import { listScheduleEntries, listScheduleTeachers } from '../api/schedule'
import type { ScheduleTeacherOption } from '../api/schedule'
import { listSubjects } from '../api/subjects'
import { ApiError, getErrorMessage } from '../api/client'
import type { Exam } from '../types/exam'
import { classroomLabel } from '../types/classroom'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { TypedPhraseConfirmModal } from './TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'

dayjs.extend(isoWeek)

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MAX_EXAMS_PER_LEVEL = 4

const SUBJECT_PALETTE = [
  '#1d4e89', '#0f766e', '#b45309', '#be123c', '#6d28d9',
  '#0369a1', '#15803d', '#c2410c', '#9f1239', '#7c3aed',
  '#0e7490', '#4d7c0f', '#a16207', '#e11d48', '#4338ca',
  '#155e75', '#166534', '#9a3412', '#86198f', '#1e40af',
]

function subjectColor(subjectId: number): string {
  return SUBJECT_PALETTE[Math.abs(subjectId) % SUBJECT_PALETTE.length]
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

export function OrtakExamPlanner({ canCreate, canDelete }: OrtakExamPlannerProps) {
  const { message, modal } = App.useApp()
  const { session } = useAuth()
  const gridRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<'manuel' | 'otomatik'>('manuel')
  const [windowStart, setWindowStart] = useState<Dayjs>(() => startOfTwoWeekWindow(dayjs()))
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<ScheduleSubjectSlot[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [autoRange, setAutoRange] = useState<[Dayjs, Dayjs] | null>(null)
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [examRows, scheduleRows, subjectRows, scheduleTeacherRows] = await Promise.all([
        listExams(),
        listScheduleEntries().catch(() => []),
        listSubjects({ is_active: true }).catch(() => []),
        listScheduleTeachers().catch(() => []),
      ])

      setExams(examRows.filter((e) => e.exam_type === 'ortak'))
      setScheduleTeachers(scheduleTeacherRows)

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

  const placedSubjectIds = useMemo(() => new Set(exams.map((e) => e.subject_id)), [exams])

  const selectedSubject = subjects.find((s) => s.subject_id === selectedSubjectId) || null

  const placeSubjectOnDate = async (slot: ScheduleSubjectSlot, dateStr: string) => {
    if (!session) return
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

  const onAutoGenerate = async () => {
    if (!session || !autoRange) {
      message.warning('Tarih aralığı seçin')
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
          Ders programından gelen bir dersi seçin, ardından satırdaki güne tıklayarak ortak sınavı
          yerleştirin. Üst sütunlar sınıf seviyeleridir; her seviyeye günde en fazla{' '}
          {MAX_EXAMS_PER_LEVEL} sınav konabilir. Öğretmen ataması ders programından otomatik
          gelir; gün detayından değiştirilebilir.
        </Typography.Paragraph>
      )}

      {mode === 'otomatik' && (
        <Space wrap style={{ marginBottom: 16 }}>
          <DatePicker.RangePicker
            value={autoRange}
            onChange={(v) => setAutoRange(v as [Dayjs, Dayjs] | null)}
            format="DD.MM.YYYY"
          />
          {canCreate && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={submitting}
              onClick={() => void onAutoGenerate()}
            >
              Otomatik Oluştur
            </Button>
          )}
          <Typography.Text type="secondary">
            Dersler hafta içi günlere dağıtılır; seviye başına günde en fazla {MAX_EXAMS_PER_LEVEL}{' '}
            sınav, zor dersler ardışık günlere konmaz.
          </Typography.Text>
        </Space>
      )}

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Ders programından dersler
        </Typography.Text>
        {subjects.length === 0 ? (
          <Empty
            description="Ders programında kayıt yok. Ders Programı sayfasından Excel ile içe yükleyin."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Space wrap size={[8, 8]}>
            {subjects.map((s) => {
              const active = selectedSubjectId === s.subject_id
              const placed = placedSubjectIds.has(s.subject_id)
              const color = subjectColor(s.subject_id)
              return (
                <Tag
                  key={s.subject_id}
                  onClick={() => {
                    if (mode !== 'manuel' || !canCreate) return
                    setSelectedSubjectId(active ? null : s.subject_id)
                  }}
                  style={{
                    cursor: mode === 'manuel' && canCreate ? 'pointer' : 'default',
                    background: active ? color : softBg(color),
                    color: active ? '#fff' : color,
                    borderColor: color,
                    padding: '4px 10px',
                    fontSize: 13,
                    opacity: placed && !active ? 0.75 : 1,
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
            Seçili: {selectedSubject.subject_name} — takvimde bir güne tıklayın
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

        {classLevels.length === 0 ? (
          <Empty description="Sınıf seviyesi bulunamadı" />
        ) : (
          <div
            ref={gridRef}
            style={{
              overflowX: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 640 + classLevels.length * 140,
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      borderRight: '1px solid #e2e8f0',
                      padding: '12px 14px',
                      textAlign: 'left',
                      width: 168,
                      fontWeight: 600,
                    }}
                  >
                    Gün
                  </th>
                  {classLevels.map((level) => (
                    <th
                      key={level}
                      style={{
                        background: '#f1f5f9',
                        borderBottom: '1px solid #e2e8f0',
                        borderRight: '1px solid #e2e8f0',
                        padding: '12px 10px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {/^\d+$/.test(level) ? `${level}. Sınıf` : level}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((day) => {
                  const dateStr = day.format('YYYY-MM-DD')
                  const dow = day.isoWeekday() - 1 // 0=Pzt … 6=Paz
                  const isWeekend = day.day() === 0 || day.day() === 6
                  const canDrop =
                    mode === 'manuel' &&
                    !!selectedSubject &&
                    canCreate &&
                    canPlaceSlotOnDate(selectedSubject, dateStr)

                  return (
                    <tr key={dateStr} style={{ background: isWeekend ? '#fafafa' : undefined }}>
                      <td
                        onClick={() => onSelectDay(day)}
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: isWeekend ? '#f1f5f9' : '#fff',
                          borderBottom: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          padding: '10px 14px',
                          cursor: 'pointer',
                          verticalAlign: 'top',
                          outline:
                            canDrop ? '2px dashed rgba(29, 78, 137, 0.45)' : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{DAY_NAMES[dow]}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{day.format('DD.MM.YYYY')}</div>
                      </td>
                      {classLevels.map((level) => {
                        const chips = subjectsByDateLevel.get(`${dateStr}|${level}`) || []
                        const full = chips.length >= MAX_EXAMS_PER_LEVEL
                        return (
                          <td
                            key={`${dateStr}|${level}`}
                            onClick={() => onSelectDay(day)}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              borderRight: '1px solid #e2e8f0',
                              padding: 8,
                              verticalAlign: 'top',
                              minHeight: 72,
                              cursor: 'pointer',
                              background: full ? '#fff7ed' : undefined,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 6,
                                minHeight: 56,
                                alignItems: 'flex-start',
                              }}
                            >
                              {chips.map((e) => (
                                <div
                                  key={e.subject_id}
                                  title={e.Subject?.name || ''}
                                  style={{
                                    background: subjectColor(e.subject_id),
                                    color: '#fff',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    fontSize: 12,
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {e.Subject?.name || `#${e.subject_id}`}
                                </div>
                              ))}
                              {chips.length === 0 && (
                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                  —
                                </Typography.Text>
                              )}
                            </div>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 10, display: 'block', marginTop: 4 }}
                            >
                              {chips.length}/{MAX_EXAMS_PER_LEVEL}
                            </Typography.Text>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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
                        background: subjectColor(exam.subject_id),
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
