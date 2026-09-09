import { useCallback, useEffect, useState } from 'react'
import { App, Button, Checkbox, DatePicker, Input, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { DownloadOutlined, FileTextOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  bulkCreateAbsences,
  deleteAbsence,
  downloadAbsenceWarningLetter,
  exportAbsences,
  fetchAbsenceWarnings,
  listAbsences,
} from '../api/absences'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import type { AbsenceWarningRow, StudentAbsence } from '../types/studentAbsence'
import type { Student } from '../types/student'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function AbsencesPage() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [students, setStudents] = useState<Student[]>([])
  const [date, setDate] = useState(dayjs())
  const [records, setRecords] = useState<StudentAbsence[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [warnings, setWarnings] = useState<AbsenceWarningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')

  const canCreate = hasPermission('attendance.create')
  const canDelete = hasPermission('attendance.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentData, recordData, warningData] = await Promise.all([
        listStudents(),
        listAbsences({ start_date: date.format('YYYY-MM-DD'), end_date: date.format('YYYY-MM-DD') }),
        fetchAbsenceWarnings(),
      ])
      setStudents(studentData)
      setRecords(recordData)
      setWarnings(warningData.data)
      setSelected(recordData.map((r) => r.student_id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [date, message])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    if (!session) return
    if (selected.length === 0) {
      message.warning('En az bir öğrenci seçin')
      return
    }
    setSubmitting(true)
    try {
      await bulkCreateAbsences(session.user.tenant_id, {
        absence_date: date.format('YYYY-MM-DD'),
        student_ids: selected,
        reason: reason || null,
      })
      message.success('Devamsızlık kaydı alındı')
      setReason('')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onRemoveRecord = async (row: StudentAbsence) => {
    try {
      await deleteAbsence(row.id)
      message.success('Kayıt silindi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDownloadLetter = async (row: AbsenceWarningRow) => {
    try {
      const blob = await downloadAbsenceWarningLetter(row.student_id)
      downloadBlob(blob, `devamsizlik-ihtar-${row.student_number || row.student_id}.pdf`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportAbsences({ format: exportFormat })
      downloadBlob(blob, exportFilename('devamsizlik-raporu', exportFormat))
      message.success('Dışa aktarma indirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const studentColumns: ColumnsType<Student> = [
    {
      title: '',
      width: 40,
      render: (_: unknown, s: Student) => (
        <Checkbox
          disabled={!canCreate}
          checked={selected.includes(s.id)}
          onChange={(e) =>
            setSelected((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
          }
        />
      ),
    },
    { title: 'Öğrenci No', dataIndex: 'student_number' },
    { title: 'Ad Soyad', render: (_: unknown, s: Student) => `${s.first_name} ${s.last_name}` },
    {
      title: 'Sınıf',
      render: (_: unknown, s: Student) => (s.class_level && s.section ? `${s.class_level}/${s.section}` : '—'),
    },
  ]

  const warningColumns: ColumnsType<AbsenceWarningRow> = [
    { title: 'Öğrenci', dataIndex: 'student_name' },
    { title: 'Öğrenci No', dataIndex: 'student_number' },
    { title: 'Sınıf', dataIndex: 'classroom', render: (v: string | null) => v || '—' },
    { title: 'Toplam Devamsızlık', dataIndex: 'count' },
    {
      title: 'Eşik',
      dataIndex: 'threshold_crossed',
      render: (v: number) => <Tag color="red">{v} gün</Tag>,
    },
    {
      title: 'İhtar Yazısı',
      render: (_: unknown, row: AbsenceWarningRow) => (
        <Button size="small" icon={<FileTextOutlined />} onClick={() => void onDownloadLetter(row)}>
          İndir
        </Button>
      ),
    },
  ]

  return (
    <AppLayout title="Devamsızlık Takibi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Devamsızlık Takibi
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'entry',
            label: 'Günlük Devamsızlık Girişi',
            children: (
              <>
                <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                  <DatePicker value={date} onChange={(v) => v && setDate(v)} format="DD.MM.YYYY" />
                  <Space wrap>
                    <Input
                      placeholder="Açıklama (opsiyonel)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ width: 220 }}
                    />
                    {canCreate && (
                      <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void onSave()}>
                        Devamsızlık Kaydet
                      </Button>
                    )}
                  </Space>
                </Space>
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={studentColumns}
                  dataSource={students}
                  pagination={{ pageSize: 20 }}
                />
                {records.length > 0 && canDelete && (
                  <>
                    <Typography.Title level={5} style={{ marginTop: 24 }}>
                      Bu tarihe ait kayıtlar
                    </Typography.Title>
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={records}
                      pagination={false}
                      columns={[
                        {
                          title: 'Öğrenci',
                          render: (_: unknown, r: StudentAbsence) =>
                            r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '—',
                        },
                        {
                          title: '',
                          width: 80,
                          render: (_: unknown, r: StudentAbsence) => (
                            <Button size="small" danger onClick={() => void onRemoveRecord(r)}>
                              Sil
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </>
                )}
              </>
            ),
          },
          {
            key: 'warnings',
            label: `Eşik Uyarıları (${warnings.length})`,
            children: <Table rowKey="student_id" columns={warningColumns} dataSource={warnings} pagination={{ pageSize: 20 }} />,
          },
        ]}
        tabBarExtraContent={
          <Space>
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel' },
                { value: 'csv', label: 'CSV' },
                { value: 'pdf', label: 'PDF' },
              ]}
              style={{ width: 100 }}
            />
            <Button icon={<DownloadOutlined />} loading={submitting} onClick={() => void onExport()}>
              Dışa Aktar
            </Button>
          </Space>
        }
      />
    </AppLayout>
  )
}
