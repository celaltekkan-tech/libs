import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Card, DatePicker, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { DownloadOutlined, FileTextOutlined, HistoryOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
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
import { listClassrooms } from '../api/classrooms'
import { getErrorMessage } from '../api/client'
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPE_OPTIONS } from '../types/studentAbsence'
import type { AbsenceEntry, AbsenceWarningRow, StudentAbsence } from '../types/studentAbsence'
import type { Student } from '../types/student'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import { AbsenceCalendarView } from '../components/AbsenceCalendarView'
import { StudentAbsenceHistory } from '../components/StudentAbsenceHistory'
import { DykAttendancePanel } from './DykPage'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function AbsencesPage() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const mainTab = searchParams.get('tab') === 'dyk' ? 'dyk' : 'school'

  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [search, setSearch] = useState('')
  const [classroomFilter, setClassroomFilter] = useState<number | null>(null)
  const [date, setDate] = useState(dayjs())
  const [records, setRecords] = useState<StudentAbsence[]>([])
  const [draft, setDraft] = useState<Record<number, { absence_type: string; reason?: string }>>({})
  const [warnings, setWarnings] = useState<AbsenceWarningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  const canCreate = hasPermission('attendance.create')
  const canDelete = hasPermission('attendance.delete')

  const setMainTab = (key: string) => {
    if (key === 'dyk') setSearchParams({ tab: 'dyk' })
    else setSearchParams({})
  }
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentData, classroomData, recordData, warningData] = await Promise.all([
        listStudents(),
        listClassrooms({ is_active: true }).catch(() => []),
        listAbsences({ start_date: date.format('YYYY-MM-DD'), end_date: date.format('YYYY-MM-DD') }),
        fetchAbsenceWarnings(),
      ])
      setStudents(studentData)
      setClassrooms(classroomData)
      setRecords(recordData)
      setWarnings(warningData.data)
      const nextDraft: Record<number, { absence_type: string; reason?: string }> = {}
      recordData.forEach((r) => {
        nextDraft[r.student_id] = { absence_type: r.absence_type, reason: r.reason || undefined }
      })
      setDraft(nextDraft)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [date, message])

  useEffect(() => {
    void load()
  }, [load])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return students.filter((s) => {
      if (classroomFilter && s.classroom_id !== classroomFilter) return false
      if (!q) return true
      const fullName = `${s.first_name} ${s.last_name}`.toLocaleLowerCase('tr-TR')
      return (
        fullName.includes(q) ||
        (s.student_number || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (s.class_level && s.section ? `${s.class_level}/${s.section}`.toLocaleLowerCase('tr-TR').includes(q) : false)
      )
    })
  }, [students, search, classroomFilter])

  const setStatus = (studentId: number, absenceType: string | null) => {
    setDraft((d) => {
      const next = { ...d }
      if (!absenceType) {
        delete next[studentId]
      } else {
        next[studentId] = { absence_type: absenceType, reason: d[studentId]?.reason }
      }
      return next
    })
  }

  const onSave = async () => {
    if (!session) return
    const entries: AbsenceEntry[] = Object.entries(draft).map(([studentId, v]) => ({
      student_id: Number(studentId),
      absence_type: v.absence_type,
      reason: v.reason || null,
    }))
    if (entries.length === 0) {
      message.warning('En az bir öğrenci için durum seçin')
      return
    }
    setSubmitting(true)
    try {
      await bulkCreateAbsences(session.user.tenant_id, { absence_date: date.format('YYYY-MM-DD'), entries })
      message.success('Devamsızlık kaydı alındı')
      setHistoryRefreshKey((k) => k + 1)
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
      setHistoryRefreshKey((k) => k + 1)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  // Arama tek öğrenciye indirgendiğinde geçmiş paneli otomatik açılsın.
  const searchedStudent = useMemo(() => {
    if (!search.trim() || filteredStudents.length !== 1) return null
    return filteredStudents[0]
  }, [search, filteredStudents])

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
    { title: 'Öğrenci No', dataIndex: 'student_number' },
    { title: 'Ad Soyad', render: (_: unknown, s: Student) => `${s.first_name} ${s.last_name}` },
    {
      title: 'Sınıf',
      render: (_: unknown, s: Student) => (s.class_level && s.section ? `${s.class_level}/${s.section}` : '—'),
    },
    {
      title: 'Durum',
      width: 180,
      render: (_: unknown, s: Student) => (
        <Select
          allowClear
          disabled={!canCreate}
          placeholder="Geldi"
          value={draft[s.id]?.absence_type}
          onChange={(v) => setStatus(s.id, v ?? null)}
          options={ABSENCE_TYPE_OPTIONS}
          style={{ width: 160 }}
        />
      ),
    },
    {
      title: '',
      width: 100,
      render: (_: unknown, s: Student) => (
        <Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStudent(s)}>
          Geçmiş
        </Button>
      ),
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
    <AppLayout title="DYK Devamsızlık Takibi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 8 }}>
        DYK Devamsızlık Takibi
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Okul genelindeki öğrenci devamsızlığı ile DYK kurs yoklaması aynı yerden yönetilir.
      </Typography.Paragraph>

      <Tabs
        activeKey={mainTab}
        onChange={setMainTab}
        items={[
          {
            key: 'school',
            label: 'Okul Devamsızlığı',
            children: (
              <Tabs
                items={[
                  {
                    key: 'entry',
                    label: 'Günlük Devamsızlık Girişi',
                    children: (
                      <>
                        <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                          <Space wrap>
                            <DatePicker value={date} onChange={(v) => v && setDate(v)} format="DD.MM.YYYY" />
                            <Input
                              allowClear
                              prefix={<SearchOutlined />}
                              placeholder="Ad, öğrenci no veya sınıf ile ara..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              style={{ width: 260 }}
                            />
                            <Select
                              allowClear
                              placeholder="Sınıf / Şube"
                              value={classroomFilter ?? undefined}
                              onChange={(v) => setClassroomFilter(v ?? null)}
                              options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))}
                              style={{ width: 160 }}
                            />
                          </Space>
                          {canCreate && (
                            <Button
                              type="primary"
                              icon={<SaveOutlined />}
                              loading={submitting}
                              onClick={() => void onSave()}
                            >
                              Devamsızlık Kaydet
                            </Button>
                          )}
                        </Space>
                        {searchedStudent && (
                          <Card size="small" style={{ marginBottom: 16 }} title="Öğrenci Devamsızlık Özeti">
                            <StudentAbsenceHistory
                              studentId={searchedStudent.id}
                              studentName={`${searchedStudent.first_name} ${searchedStudent.last_name}`}
                              refreshKey={historyRefreshKey}
                            />
                          </Card>
                        )}
                        <Table
                          rowKey="id"
                          loading={loading}
                          columns={studentColumns}
                          dataSource={filteredStudents}
                          pagination={{ pageSize: 20 }}
                          scroll={{ x: 'max-content' }}
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
                              scroll={{ x: 'max-content' }}
                              columns={[
                                {
                                  title: 'Öğrenci',
                                  render: (_: unknown, r: StudentAbsence) =>
                                    r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '—',
                                },
                                {
                                  title: 'Durum',
                                  dataIndex: 'absence_type',
                                  render: (v: string) => ABSENCE_TYPE_LABELS[v] || v,
                                },
                                {
                                  title: 'Açıklama',
                                  dataIndex: 'reason',
                                  render: (v: string | null) => v || '—',
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
                    children: (
                      <Table
                        rowKey="student_id"
                        columns={warningColumns}
                        dataSource={warnings}
                        pagination={{ pageSize: 20 }}
                        scroll={{ x: 'max-content' }}
                      />
                    ),
                  },
                  {
                    key: 'calendar',
                    label: 'Takvim',
                    children: <AbsenceCalendarView />,
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
            ),
          },
          {
            key: 'dyk',
            label: 'DYK Kurs Yoklaması',
            children: <DykAttendancePanel />,
          },
        ]}
      />

      <Modal
        title={
          historyStudent
            ? `Devamsızlık Geçmişi — ${historyStudent.first_name} ${historyStudent.last_name}`
            : 'Devamsızlık Geçmişi'
        }
        open={!!historyStudent}
        onCancel={() => setHistoryStudent(null)}
        footer={<Button onClick={() => setHistoryStudent(null)}>Kapat</Button>}
        width={720}
        destroyOnClose
      >
        {historyStudent && (
          <StudentAbsenceHistory studentId={historyStudent.id} refreshKey={historyRefreshKey} />
        )}
      </Modal>
    </AppLayout>
  )
}
