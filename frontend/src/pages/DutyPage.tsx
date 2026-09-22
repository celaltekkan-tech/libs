import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
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
  createDutyAssignment,
  createDutyLocation,
  deleteDutyAssignment,
  deleteDutyLocation,
  exportDuty,
  listDutyAssignments,
  listDutyLocations,
} from '../api/duty'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { DutyAssignment, DutyLocation } from '../types/duty'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

dayjs.extend(isoWeek)
dayjs.locale('tr')

const WEEKDAY_COUNT = 5
const CAPACITY_STORAGE_KEY = 'duty-daily-capacity'

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

function TeacherDutyName({ name, dayIndexes }: { name: string; dayIndexes: number[] }) {
  const unique = [...new Set(dayIndexes)].sort((a, b) => a - b)
  if (unique.length === 0) return <span>{name}</span>
  if (unique.length === 1) {
    const color = DUTY_DAY_COLORS[unique[0] % DUTY_DAY_COLORS.length]
    return (
      <span className="duty-teacher-name" style={{ background: color, color: '#fff' }}>
        {name}
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
      {name}
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
  const [submitting, setSubmitting] = useState(false)
  const [activeCell, setActiveCell] = useState<CellTarget | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [setupForm] = Form.useForm<{ location_names: string; capacity: number }>()

  const canCreate = hasPermission('duty.create')
  const canDelete = hasPermission('duty.delete')

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
        locationData.filter((l) => l.is_active).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
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
    if (!loading && locations.length === 0 && canCreate) setSetupOpen(true)
  }, [loading, locations.length, canCreate])

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

  /** date → slot sırasına dizilmiş atamalar (alfabetik yer adına göre) */
  const slotsByDate = useMemo(() => {
    const map = new Map<string, DutyAssignment[]>()
    for (const a of assignments) {
      const list = map.get(a.duty_date) || []
      list.push(a)
      map.set(a.duty_date, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) =>
        (a.DutyLocation?.name || '').localeCompare(b.DutyLocation?.name || '', 'tr'),
      )
    }
    return map
  }, [assignments])

  const assignmentByCell = useMemo(() => {
    const map = new Map<string, DutyAssignment>()
    for (const a of assignments) {
      map.set(`${a.duty_location_id}|${a.duty_date}`, a)
    }
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

        for (const name of names) {
          const key = name.toLocaleLowerCase('tr-TR')
          if (!existingByName.has(key)) {
            await createDutyLocation(tenantId, { name })
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
    const existing = assignmentByCell.get(`${activeCell.locationId}|${activeCell.date}`)
    const daySlots = slotsByDate.get(activeCell.date) || []

    if (!existing && daySlots.length >= capacity) {
      message.warning(`Bu gün için en fazla ${capacity} nöbetçi olabilir`)
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
    const existing = assignmentByCell.get(`${activeCell.locationId}|${activeCell.date}`)
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
    ? assignmentByCell.get(`${activeCell.locationId}|${activeCell.date}`)
    : undefined

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
      <div className="duty-teacher-picker-list">
        {teachers.map((t) => {
          const days = teacherDayMap.get(t.id) || []
          const busyOther =
            teachersBusyOnActiveDay.has(t.id) && activeAssignment?.teacher_id !== t.id
          const selected = activeAssignment?.teacher_id === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`duty-teacher-picker-item${selected ? ' is-selected' : ''}${busyOther ? ' is-disabled' : ''}`}
              disabled={busyOther || submitting || !canCreate}
              onClick={() => void assignTeacher(t.id)}
            >
              <TeacherDutyName name={teacherLabel(t)} dayIndexes={days} />
              {busyOther && <span className="duty-teacher-picker-hint">bu gün dolu</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  const slotIndexes = useMemo(() => Array.from({ length: capacity }, (_, i) => i), [capacity])

  return (
    <AppLayout title="Nöbet Programı">
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Nöbet Programı
          </Typography.Title>
          <Typography.Text type="secondary">
            Sütunlar nöbet yerleri; her gün için {capacity} nöbetçi satırı. Kutuya tıklayarak öğretmen seçin.
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
                  const dayAssignments = slotsByDate.get(dateStr) || []

                  return slotIndexes.map((slot) => {
                    const slotAssignment = dayAssignments[slot] || null
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
                              {day.format('DD.MM')} · {dayAssignments.length}/{capacity}
                            </span>
                          </th>
                        ) : null}

                        {locations.map((loc) => {
                          const cellAssignment =
                            slotAssignment && slotAssignment.duty_location_id === loc.id
                              ? slotAssignment
                              : null
                          const locationTakenElsewhere =
                            !cellAssignment && Boolean(assignmentByCell.get(`${loc.id}|${dateStr}`))
                          const slotFilledElsewhere = Boolean(slotAssignment) && !cellAssignment
                          // Sadece sıradaki boş satıra atama yapılabilir
                          const notNextEmptySlot = !slotAssignment && slot !== dayAssignments.length
                          const locked = locationTakenElsewhere || slotFilledElsewhere || notNextEmptySlot

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
      >
        <Typography.Paragraph type="secondary">
          Nöbet yeri isimlerini ve her gün kaç nöbetçi olabileceğini girin. Tablo boş hazırlanır; atamaları
          kutucuklara tıklayarak yaparsınız.
        </Typography.Paragraph>
        <Form
          form={setupForm}
          layout="vertical"
          onFinish={onSetup}
          initialValues={{ capacity, location_names: '' }}
        >
          <Form.Item
            name="location_names"
            label="Nöbet yerleri"
            rules={[{ required: true, message: 'En az bir yer adı girin' }]}
            extra="Her satıra bir yer yazın (veya virgülle ayırın)."
          >
            <Input.TextArea rows={5} placeholder={'Giriş\nKoridor\nBahçe'} />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Günlük nöbetçi kapasitesi"
            rules={[{ required: true, message: 'Kapasite zorunludur' }]}
            extra="Bir günde en fazla kaç nöbetçi olabilir (olacağı değil, olabileceği). Her gün için bu kadar satır açılır."
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
