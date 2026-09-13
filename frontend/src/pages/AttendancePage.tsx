import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DownloadOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  bulkUpsertAttendance,
  deleteAttendance,
  exportAttendance,
  fetchAttendanceMonthlySummary,
  listAttendance,
} from '../api/attendance'
import { listHolidays } from '../api/holidays'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import {
  ABSENCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_OPTIONS,
  TYP_STATUS_CODES,
} from '../types/attendanceRecord'
import type { AttendanceMonthlySummaryRow, AttendanceRecord } from '../types/attendanceRecord'
import type { Holiday } from '../types/holiday'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

const now = new Date()
const MONTH_LABELS = [
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

interface DraftEntry {
  status: string
  overtime_hours: number | null
  notes: string
}

function weekendDays(year: number, month: number): number[] {
  const dim = new Date(year, month, 0).getDate()
  const days: number[] = []
  for (let d = 1; d <= dim; d += 1) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) days.push(d)
  }
  return days
}

function holidayDaysForMonth(holidays: Holiday[], year: number, month: number): number[] {
  return holidays
    .filter((h) => h.month === month && (h.year == null || h.year === year))
    .map((h) => h.day)
}

export function AttendancePage() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [date, setDate] = useState(dayjs())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [draft, setDraft] = useState<Record<number, DraftEntry>>({})
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<AttendanceMonthlySummaryRow[]>([])
  const [monthAbsences, setMonthAbsences] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [exportOpen, setExportOpen] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [closedDays, setClosedDays] = useState<number[]>([])
  const [exportForm] = Form.useForm()

  const canCreate = hasPermission('payroll.create')
  const canDelete = hasPermission('payroll.delete')

  const workerTeachers = useMemo(
    () => teachers.filter((t) => ['isci', 'typ'].includes(t.personnel_type)),
    [teachers],
  )

  const autoClosedDays = useMemo(() => {
    const set = new Set([
      ...weekendDays(year, month),
      ...holidayDaysForMonth(holidays, year, month),
    ])
    return Array.from(set).sort((a, b) => a - b)
  }, [year, month, holidays])

  const daysInSelectedMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])

  const openExportModal = () => {
    const typTeacher = workerTeachers.find((t) => t.personnel_type === 'typ') || workerTeachers[0]
    exportForm.setFieldsValue({
      typ_no: '',
      typ_subject: typTeacher?.title_branch || '',
      typ_start_date: typTeacher?.contract_start_date
        ? dayjs(typTeacher.contract_start_date).format('DD/MM/YYYY')
        : '',
      typ_end_date: typTeacher?.contract_end_date
        ? dayjs(typTeacher.contract_end_date).format('DD/MM/YYYY')
        : '',
    })
    setClosedDays(autoClosedDays)
    setExportOpen(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherData, recordData, summaryData, holidayData, monthAbsenceData] = await Promise.all([
        listTeachers(),
        listAttendance({ attendance_date: date.format('YYYY-MM-DD') }),
        fetchAttendanceMonthlySummary(year, month),
        listHolidays(),
        listAttendance({ year, month }),
      ])
      setTeachers(teacherData)
      setRecords(recordData)
      setSummary(summaryData)
      setHolidays(holidayData)
      setMonthAbsences(monthAbsenceData.filter((r) => ABSENCE_STATUSES.has(r.status)))
      const nextDraft: Record<number, DraftEntry> = {}
      recordData.forEach((r) => {
        nextDraft[r.teacher_id] = {
          status: r.status,
          overtime_hours: r.overtime_hours ? Number(r.overtime_hours) : null,
          notes: r.notes || '',
        }
      })
      setDraft(nextDraft)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [date, year, month, message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!exportOpen) return
    setClosedDays(autoClosedDays)
  }, [autoClosedDays, exportOpen])

  const setStatus = (teacherId: number, status: string) => {
    setDraft((d) => ({
      ...d,
      [teacherId]: {
        status,
        overtime_hours: d[teacherId]?.overtime_hours ?? null,
        notes: d[teacherId]?.notes ?? '',
      },
    }))
  }

  const setOvertime = (teacherId: number, hours: number | null) => {
    setDraft((d) => ({
      ...d,
      [teacherId]: {
        status: d[teacherId]?.status || 'geldi',
        overtime_hours: hours,
        notes: d[teacherId]?.notes ?? '',
      },
    }))
  }

  const setNotes = (teacherId: number, notes: string) => {
    setDraft((d) => ({
      ...d,
      [teacherId]: {
        status: d[teacherId]?.status || 'gelmedi',
        overtime_hours: d[teacherId]?.overtime_hours ?? null,
        notes,
      },
    }))
  }

  const onSave = async () => {
    if (!session) return
    const entries = Object.entries(draft)
      .filter(([, v]) => v.status)
      .map(([teacherId, v]) => ({
        teacher_id: Number(teacherId),
        status: v.status,
        overtime_hours: v.overtime_hours ?? null,
        notes: ABSENCE_STATUSES.has(v.status) ? v.notes?.trim() || null : null,
      }))
    if (entries.length === 0) {
      message.warning('En az bir personel için durum seçin')
      return
    }
    setSubmitting(true)
    try {
      await bulkUpsertAttendance(session.user.tenant_id, date.format('YYYY-MM-DD'), entries)
      message.success('Günlük puantaj kaydedildi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteRecord = async (row: AttendanceRecord) => {
    try {
      await deleteAttendance(row.id)
      message.success('Kayıt silindi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const values = await exportForm.validateFields()
      const blob = await exportAttendance({
        format: exportFormat,
        year,
        month,
        closed_days: closedDays,
        typ_no: values.typ_no || undefined,
        typ_subject: values.typ_subject || undefined,
        typ_start_date: values.typ_start_date || undefined,
        typ_end_date: values.typ_end_date || undefined,
      })
      const base = exportFormat === 'xlsx' ? 'typ-gunluk-puantaj' : 'puantaj-cizelgesi'
      downloadBlob(blob, exportFilename(`${base}-${year}-${String(month).padStart(2, '0')}`, exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const todayAbsences = useMemo(() => {
    return workerTeachers
      .filter((t) => draft[t.id] && ABSENCE_STATUSES.has(draft[t.id].status))
      .map((t) => ({
        teacher: t,
        status: draft[t.id].status,
        notes: draft[t.id].notes,
        code: TYP_STATUS_CODES[draft[t.id].status] || '',
      }))
  }, [workerTeachers, draft])

  const columns: ColumnsType<Teacher> = [
    { title: 'Personel', render: (_: unknown, t: Teacher) => `${t.first_name} ${t.last_name}` },
    {
      title: 'Durum',
      width: 180,
      render: (_: unknown, t: Teacher) => (
        <Select
          disabled={!canCreate}
          style={{ width: '100%' }}
          placeholder="Seçin"
          value={draft[t.id]?.status}
          onChange={(v) => setStatus(t.id, v)}
          options={ATTENDANCE_STATUS_OPTIONS}
        />
      ),
    },
    {
      title: 'Kod',
      width: 56,
      render: (_: unknown, t: Teacher) => {
        const status = draft[t.id]?.status
        const code = status ? TYP_STATUS_CODES[status] : ''
        return code ? <Tag>{code}</Tag> : '—'
      },
    },
    {
      title: 'Neden / Açıklama',
      render: (_: unknown, t: Teacher) => {
        const status = draft[t.id]?.status
        if (!status || !ABSENCE_STATUSES.has(status)) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        return (
          <Input
            disabled={!canCreate}
            placeholder="Devamsızlık nedeni"
            value={draft[t.id]?.notes || ''}
            onChange={(e) => setNotes(t.id, e.target.value)}
            maxLength={255}
          />
        )
      },
    },
    {
      title: 'Fazla Mesai (saat)',
      width: 140,
      render: (_: unknown, t: Teacher) => (
        <InputNumber
          disabled={!canCreate}
          min={0}
          max={24}
          value={draft[t.id]?.overtime_hours ?? undefined}
          onChange={(v) => setOvertime(t.id, v == null ? null : Number(v))}
        />
      ),
    },
  ]

  const existingColumns: ColumnsType<AttendanceRecord> = [
    {
      title: 'Personel',
      render: (_: unknown, r: AttendanceRecord) =>
        r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—',
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (v: string) => ATTENDANCE_STATUS_LABELS[v] || v,
    },
    { title: 'Kod', width: 56, render: (_: unknown, r: AttendanceRecord) => TYP_STATUS_CODES[r.status] || '—' },
    { title: 'Neden', dataIndex: 'notes', render: (v: string | null) => v || '—' },
    {
      title: 'Fazla Mesai',
      dataIndex: 'overtime_hours',
      render: (v: string | number | null) => v || '—',
    },
    ...(canDelete
      ? [
          {
            title: 'İşlemler',
            width: 80,
            render: (_: unknown, record: AttendanceRecord) => (
              <Button size="small" danger onClick={() => void onDeleteRecord(record)}>
                Sil
              </Button>
            ),
          },
        ]
      : []),
  ]

  const monthAbsenceColumns: ColumnsType<AttendanceRecord> = [
    {
      title: 'Tarih',
      dataIndex: 'attendance_date',
      width: 110,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: 'Personel',
      render: (_: unknown, r: AttendanceRecord) =>
        r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—',
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (v: string) => ATTENDANCE_STATUS_LABELS[v] || v,
    },
    {
      title: 'Kod',
      width: 56,
      render: (_: unknown, r: AttendanceRecord) => TYP_STATUS_CODES[r.status] || '—',
    },
    { title: 'Neden', dataIndex: 'notes', render: (v: string | null) => v || '—' },
  ]

  return (
    <AppLayout title="İşçi / TYP Puantaj Takibi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        İşçi / TYP Puantaj Takibi
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <DatePicker value={date} onChange={(v) => v && setDate(v)} format="DD.MM.YYYY" />
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={openExportModal}>
            TYP Puantajı İndir
          </Button>
          {canCreate && (
            <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void onSave()}>
              Günlük Puantajı Kaydet
            </Button>
          )}
        </Space>
      </Space>

      {workerTeachers.length === 0 ? (
        <Typography.Text type="secondary">
          Henüz "İşçi" veya "TYP" personel tipi tanımlı personel yok. Öğretmenler sayfasından personel tipini
          güncelleyin.
        </Typography.Text>
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={workerTeachers}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}

      {todayAbsences.length > 0 && (
        <Card
          size="small"
          title={`${date.format('DD.MM.YYYY')} — Devamsızlık / mazeret özeti`}
          style={{ marginTop: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {todayAbsences.map(({ teacher, status, notes, code }) => (
              <Space key={teacher.id} wrap>
                <Typography.Text strong>
                  {teacher.first_name} {teacher.last_name}
                </Typography.Text>
                <Tag color="orange">
                  {ATTENDANCE_STATUS_LABELS[status] || status}
                  {code ? ` · ${code}` : ''}
                </Tag>
                <Typography.Text type="secondary">{notes?.trim() || 'Neden belirtilmedi'}</Typography.Text>
              </Space>
            ))}
          </Space>
        </Card>
      )}

      {records.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            {date.format('DD.MM.YYYY')} tarihli kayıtlar
          </Typography.Title>
          <Table
            rowKey="id"
            size="small"
            columns={existingColumns}
            dataSource={records}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      )}

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Aylık Devamsızlık Defteri
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Seçili aydaki gelmeme / izin / rapor / mazeret kayıtları. Excel’de ilgili hücreye kod yazılır (R, D, Ü,
        M, İ); neden burada saklanır.
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Select
          value={year}
          onChange={setYear}
          options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))}
          style={{ width: 100 }}
        />
        <Select
          value={month}
          onChange={setMonth}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}. Ay` }))}
          style={{ width: 100 }}
        />
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={monthAbsenceColumns}
        dataSource={monthAbsences}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'Bu ayda devamsızlık kaydı yok' }}
        scroll={{ x: 'max-content' }}
      />

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Aylık Puantaj Özeti
      </Typography.Title>
      <Collapse
        items={summary.map((row) => ({
          key: row.teacher_id,
          label: (
            <Space>
              <span>{row.teacher_name}</span>
              {row.overtime_total > 0 && <Tag color="orange">{row.overtime_total} saat fazla mesai</Tag>}
            </Space>
          ),
          children: (
            <Table
              size="small"
              rowKey="status"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={Object.entries(row.counts).map(([status, count]) => ({ status, count }))}
              columns={[
                {
                  title: 'Durum',
                  dataIndex: 'status',
                  render: (v: string) => ATTENDANCE_STATUS_LABELS[v] || v,
                },
                { title: 'Gün Sayısı', dataIndex: 'count' },
                {
                  title: 'Kod',
                  render: (_: unknown, r: { status: string }) => TYP_STATUS_CODES[r.status] || '—',
                },
              ]}
            />
          ),
        }))}
      />

      <Modal
        title="TYP Günlük Puantaj İndir"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        okText="İndir"
        confirmLoading={submitting}
        width={640}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Excel çıktısı İŞKUR EK-2 formatındadır. Kapalı günler orta gri dolgu ile işaretlenir. İmza günleri
          boş bırakılır; devamsızlık kodları (R, D, Ü, M, İ) ilgili hücrelere yazılır.
        </Typography.Paragraph>

        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={year}
            onChange={setYear}
            options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))}
            style={{ width: 100 }}
          />
          <Select
            value={month}
            onChange={setMonth}
            options={MONTH_LABELS.map((label, i) => ({ value: i + 1, label }))}
            style={{ width: 140 }}
          />
          <Select
            value={exportFormat}
            onChange={setExportFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx) — EK-2' },
              { value: 'csv', label: 'CSV' },
              { value: 'pdf', label: 'PDF (özet)' },
            ]}
            style={{ width: 200 }}
          />
        </Space>

        {exportFormat === 'xlsx' && (
          <>
            <Form form={exportForm} layout="vertical" size="small">
              <Space wrap style={{ width: '100%' }} align="start">
                <Form.Item name="typ_no" label="TYP No" style={{ minWidth: 140 }}>
                  <Input placeholder="Opsiyonel" />
                </Form.Item>
                <Form.Item name="typ_subject" label="TYP Konusu" style={{ minWidth: 180 }}>
                  <Input placeholder="Örn. GÜVENLİK" />
                </Form.Item>
                <Form.Item name="typ_start_date" label="Başlama Tarihi" style={{ minWidth: 140 }}>
                  <Input placeholder="GG/AA/YYYY" />
                </Form.Item>
                <Form.Item name="typ_end_date" label="Bitiş Tarihi" style={{ minWidth: 140 }}>
                  <Input placeholder="GG/AA/YYYY" />
                </Form.Item>
              </Space>
            </Form>

            <Typography.Text strong>Kapatılacak günler</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              Orta gri dolgu. Seçilmeyen günler imza için boş kalır.
            </Typography.Paragraph>
            <Checkbox.Group
              value={closedDays}
              onChange={(vals) => setClosedDays(vals as number[])}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
              options={Array.from({ length: daysInSelectedMonth }, (_, i) => {
                const day = i + 1
                const isHoliday = holidayDaysForMonth(holidays, year, month).includes(day)
                const isWeekend = weekendDays(year, month).includes(day)
                return {
                  value: day,
                  label: `${day}${isHoliday ? ' (tatil)' : isWeekend ? ' (hs)' : ''}`,
                }
              })}
            />
            <Space style={{ marginTop: 8 }}>
              <Button size="small" onClick={() => setClosedDays(autoClosedDays)}>
                Hafta sonu + tatil
              </Button>
              <Button size="small" onClick={() => setClosedDays([])}>
                Tümünü aç
              </Button>
              <Button
                size="small"
                onClick={() =>
                  setClosedDays(Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1))
                }
              >
                Tümünü kapat
              </Button>
            </Space>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}
