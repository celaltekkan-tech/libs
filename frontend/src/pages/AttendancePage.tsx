import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Collapse, DatePicker, InputNumber, Select, Space, Table, Tag, Typography } from 'antd'
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
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_OPTIONS } from '../types/attendanceRecord'
import type { AttendanceMonthlySummaryRow, AttendanceRecord } from '../types/attendanceRecord'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

const now = new Date()

interface DraftEntry {
  status: string
  overtime_hours: number | null
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [exportOpen, setExportOpen] = useState(false)

  const canCreate = hasPermission('payroll.create')
  const canDelete = hasPermission('payroll.delete')

  const workerTeachers = useMemo(
    () => teachers.filter((t) => ['isci', 'typ'].includes(t.personnel_type)),
    [teachers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherData, recordData, summaryData] = await Promise.all([
        listTeachers(),
        listAttendance({ attendance_date: date.format('YYYY-MM-DD') }),
        fetchAttendanceMonthlySummary(year, month),
      ])
      setTeachers(teacherData)
      setRecords(recordData)
      setSummary(summaryData)
      const nextDraft: Record<number, DraftEntry> = {}
      recordData.forEach((r) => {
        nextDraft[r.teacher_id] = { status: r.status, overtime_hours: r.overtime_hours ? Number(r.overtime_hours) : null }
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

  const setStatus = (teacherId: number, status: string) => {
    setDraft((d) => ({ ...d, [teacherId]: { status, overtime_hours: d[teacherId]?.overtime_hours ?? null } }))
  }

  const setOvertime = (teacherId: number, hours: number | null) => {
    setDraft((d) => ({ ...d, [teacherId]: { status: d[teacherId]?.status || 'geldi', overtime_hours: hours } }))
  }

  const onSave = async () => {
    if (!session) return
    const entries = Object.entries(draft)
      .filter(([, v]) => v.status)
      .map(([teacherId, v]) => ({
        teacher_id: Number(teacherId),
        status: v.status,
        overtime_hours: v.overtime_hours ?? null,
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
      const blob = await exportAttendance({ format: exportFormat, year, month })
      downloadBlob(blob, exportFilename('puantaj-cizelgesi', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<Teacher> = [
    { title: 'Personel', render: (_: unknown, t: Teacher) => `${t.first_name} ${t.last_name}` },
    {
      title: 'Durum',
      render: (_: unknown, t: Teacher) => (
        <Select
          disabled={!canCreate}
          style={{ width: 150 }}
          placeholder="Seçin"
          value={draft[t.id]?.status}
          onChange={(v) => setStatus(t.id, v)}
          options={ATTENDANCE_STATUS_OPTIONS}
        />
      ),
    },
    {
      title: 'Fazla Mesai (saat)',
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
    { title: 'Personel', render: (_: unknown, r: AttendanceRecord) => (r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—') },
    { title: 'Durum', dataIndex: 'status', render: (v: string) => ATTENDANCE_STATUS_LABELS[v] || v },
    { title: 'Fazla Mesai', dataIndex: 'overtime_hours', render: (v: string | number | null) => v || '—' },
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

  return (
    <AppLayout title="İşçi / TYP Puantaj Takibi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        İşçi / TYP Puantaj Takibi
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <DatePicker value={date} onChange={(v) => v && setDate(v)} format="DD.MM.YYYY" />
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
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
        <Table rowKey="id" loading={loading} columns={columns} dataSource={workerTeachers} pagination={false} />
      )}

      {records.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            {date.format('DD.MM.YYYY')} tarihli kayıtlar
          </Typography.Title>
          <Table rowKey="id" size="small" columns={existingColumns} dataSource={records} pagination={false} />
        </>
      )}

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Aylık Puantaj Özeti
      </Typography.Title>
      <Space style={{ marginBottom: 12 }}>
        <Select value={year} onChange={setYear} options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))} style={{ width: 100 }} />
        <Select
          value={month}
          onChange={setMonth}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}. Ay` }))}
          style={{ width: 100 }}
        />
      </Space>
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
              dataSource={Object.entries(row.counts).map(([status, count]) => ({ status, count }))}
              columns={[
                { title: 'Durum', dataIndex: 'status', render: (v: string) => ATTENDANCE_STATUS_LABELS[v] || v },
                { title: 'Gün Sayısı', dataIndex: 'count' },
              ]}
            />
          ),
        }))}
      />

      {exportOpen && (
        <Space direction="vertical" style={{ marginTop: 16 }}>
          <Select
            value={exportFormat}
            onChange={setExportFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx)' },
              { value: 'csv', label: 'CSV (.csv)' },
              { value: 'pdf', label: 'PDF' },
            ]}
          />
          <Space>
            <Button type="primary" loading={submitting} onClick={() => void onExport()}>
              İndir
            </Button>
            <Button onClick={() => setExportOpen(false)}>Vazgeç</Button>
          </Space>
        </Space>
      )}
    </AppLayout>
  )
}
