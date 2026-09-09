import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createScheduleEntry,
  deleteScheduleEntry,
  exportSchedule,
  fetchHoursCheck,
  fetchTeacherLoad,
  listScheduleEntries,
} from '../api/schedule'
import type { HoursCheckRow } from '../api/schedule'
import { listSubjects } from '../api/subjects'
import { listTeachers } from '../api/teachers'
import { listClassrooms } from '../api/classrooms'
import { classroomLabel } from '../types/classroom'
import { getErrorMessage } from '../api/client'
import { DAY_LABELS, DAY_OPTIONS } from '../types/scheduleEntry'
import type { ScheduleEntry, ScheduleEntryPayload, TeacherLoadRow } from '../types/scheduleEntry'
import type { Subject } from '../types/subject'
import type { Teacher } from '../types/teacher'
import type { Classroom } from '../types/classroom'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

type ViewMode = 'classroom' | 'teacher'

export function SchedulePage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [teacherLoad, setTeacherLoad] = useState<TeacherLoadRow[]>([])
  const [hoursCheck, setHoursCheck] = useState<HoursCheckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('classroom')
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<ScheduleEntryPayload>()

  const canCreate = hasPermission('schedule.create')
  const canDelete = hasPermission('schedule.delete')

  const loadLookups = useCallback(async () => {
    setLoading(true)
    try {
      const [classroomData, teacherData, subjectData, loadData] = await Promise.all([
        listClassrooms(),
        listTeachers(),
        listSubjects({ is_active: true }),
        fetchTeacherLoad().catch(() => []),
      ])
      setClassrooms(classroomData)
      setTeachers(teacherData)
      setSubjects(subjectData)
      setTeacherLoad(loadData)
      if (classroomData.length > 0) setSelectedClassroomId(classroomData[0].id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  const loadEntries = useCallback(async () => {
    if (viewMode === 'classroom' && !selectedClassroomId) {
      setEntries([])
      return
    }
    if (viewMode === 'teacher' && !selectedTeacherId) {
      setEntries([])
      return
    }
    setEntriesLoading(true)
    try {
      const data = await listScheduleEntries(
        viewMode === 'classroom' ? { classroom_id: selectedClassroomId! } : { teacher_id: selectedTeacherId! },
      )
      setEntries(data)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setEntriesLoading(false)
    }
  }, [viewMode, selectedClassroomId, selectedTeacherId, message])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const loadHoursCheck = useCallback(async () => {
    if (viewMode !== 'classroom' || !selectedClassroomId) {
      setHoursCheck([])
      return
    }
    try {
      setHoursCheck(await fetchHoursCheck(selectedClassroomId))
    } catch {
      setHoursCheck([])
    }
  }, [viewMode, selectedClassroomId])

  useEffect(() => {
    void loadHoursCheck()
  }, [loadHoursCheck])

  const grid = useMemo(() => {
    const map = new Map<string, ScheduleEntry>()
    entries.forEach((entry) => map.set(`${entry.day_of_week}-${entry.period_no}`, entry))
    return map
  }, [entries])

  const openCreate = (dayOfWeek?: number, periodNo?: number) => {
    if (viewMode !== 'classroom' || !selectedClassroomId) return
    form.resetFields()
    form.setFieldsValue({
      classroom_id: selectedClassroomId,
      day_of_week: dayOfWeek,
      period_no: periodNo,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: ScheduleEntryPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const { hoursWarning } = await createScheduleEntry(session.user.tenant_id, {
        ...values,
        teacher_id: values.teacher_id || null,
        academic_year: values.academic_year || null,
      })
      message.success('Ders programı kaydı eklendi')
      if (hoursWarning) modal.warning({ title: 'Ders Yükü Uyarısı', content: hoursWarning })
      setModalOpen(false)
      void loadEntries()
      void loadHoursCheck()
      void fetchTeacherLoad().then(setTeacherLoad).catch(() => undefined)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (entry: ScheduleEntry) => {
    modal.confirm({
      title: 'Kaydı sil',
      content: `${DAY_LABELS[entry.day_of_week]} günü ${entry.period_no}. saat dersini silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          const { hoursWarning } = await deleteScheduleEntry(entry.id)
          message.success('Kayıt silindi')
          if (hoursWarning) modal.warning({ title: 'Ders Yükü Uyarısı', content: hoursWarning })
          void loadEntries()
          void loadHoursCheck()
          void fetchTeacherLoad().then(setTeacherLoad).catch(() => undefined)
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const filters =
        viewMode === 'classroom' && selectedClassroomId
          ? { classroom_id: selectedClassroomId }
          : viewMode === 'teacher' && selectedTeacherId
            ? { teacher_id: selectedTeacherId }
            : undefined
      const blob = await exportSchedule({ format: exportFormat, filters })
      downloadBlob(blob, exportFilename('ders-programi', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const renderCell = (day: number, period: number) => {
    const entry = grid.get(`${day}-${period}`)
    if (!entry) {
      return viewMode === 'classroom' && canCreate ? (
        <button className="schedule-cell schedule-cell-empty" onClick={() => openCreate(day, period)} type="button">
          +
        </button>
      ) : (
        <div className="schedule-cell schedule-cell-empty" />
      )
    }
    return (
      <div className="schedule-cell schedule-cell-filled">
        <div className="schedule-cell-subject">{entry.Subject?.name || '—'}</div>
        <div className="schedule-cell-detail">
          {viewMode === 'classroom'
            ? entry.Teacher
              ? `${entry.Teacher.first_name} ${entry.Teacher.last_name}`
              : ''
            : entry.Classroom
              ? classroomLabel(entry.Classroom)
              : ''}
        </div>
        {canDelete && (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(entry)}
            style={{ position: 'absolute', top: 0, right: 0 }}
          />
        )}
      </div>
    )
  }

  return (
    <AppLayout title="Ders Dağıtım ve Ders Programı">
      <style>{`
        .schedule-grid { display: grid; grid-template-columns: 60px repeat(6, 1fr); gap: 4px; margin-top: 16px; }
        .schedule-head { font-weight: 600; text-align: center; padding: 8px 4px; }
        .schedule-cell { position: relative; min-height: 56px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; justify-content: center; }
        .schedule-cell-empty { background: transparent; color: #9ca3af; cursor: pointer; align-items: center; }
        .schedule-cell-filled { background: #f0f5ff; }
        .schedule-cell-subject { font-weight: 600; font-size: 12px; }
        .schedule-cell-detail { font-size: 11px; color: #4b5563; }
        .schedule-period { display: flex; align-items: center; justify-content: center; font-weight: 600; color: #6b7280; }
      `}</style>

      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Ders Dağıtım ve Haftalık Ders Programı
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { value: 'classroom', label: 'Sınıfa göre' },
              { value: 'teacher', label: 'Öğretmene göre' },
            ]}
            style={{ width: 160 }}
          />
          {viewMode === 'classroom' ? (
            <Select
              value={selectedClassroomId ?? undefined}
              onChange={setSelectedClassroomId}
              placeholder="Sınıf seçin"
              showSearch
              optionFilterProp="label"
              loading={loading}
              options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))}
              style={{ width: 220 }}
            />
          ) : (
            <Select
              value={selectedTeacherId ?? undefined}
              onChange={setSelectedTeacherId}
              placeholder="Öğretmen seçin"
              showSearch
              optionFilterProp="label"
              loading={loading}
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
              style={{ width: 220 }}
            />
          )}
        </Space>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
          {viewMode === 'classroom' && canCreate && selectedClassroomId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
              Yeni Kayıt
            </Button>
          )}
        </Space>
      </Space>

      {(viewMode === 'classroom' && !selectedClassroomId) || (viewMode === 'teacher' && !selectedTeacherId) ? (
        <Empty description="Görüntülemek için bir seçim yapın" />
      ) : (
        <div className="schedule-grid" aria-busy={entriesLoading}>
          <div />
          {DAY_OPTIONS.map((d) => (
            <div className="schedule-head" key={d.value}>
              {d.label}
            </div>
          ))}
          {PERIODS.map((period) => (
            <Fragment key={period}>
              <div className="schedule-period">{period}</div>
              {DAY_OPTIONS.map((d) => (
                <div key={`${d.value}-${period}`}>{renderCell(d.value, period)}</div>
              ))}
            </Fragment>
          ))}
        </div>
      )}

      {viewMode === 'classroom' && hoursCheck.length > 0 && (
        <>
          <Typography.Title level={4} style={{ marginTop: 32 }}>
            Ders Yükü Kontrolü
          </Typography.Title>
          <Table
            size="small"
            rowKey="subject_id"
            pagination={false}
            dataSource={hoursCheck}
            columns={[
              { title: 'Ders', dataIndex: 'subject_name' },
              { title: 'Gerekli Saat', dataIndex: 'required_hours' },
              { title: 'Programdaki Saat', dataIndex: 'scheduled_hours' },
              {
                title: 'Durum',
                dataIndex: 'status',
                render: (v: HoursCheckRow['status']) => (
                  <Tag color={v === 'tam' ? 'green' : v === 'eksik' ? 'red' : 'orange'}>
                    {v === 'tam' ? 'Tam' : v === 'eksik' ? 'Eksik' : 'Fazla'}
                  </Tag>
                ),
              },
            ]}
          />
        </>
      )}

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Öğretmen Ders Yükü
      </Typography.Title>
      <Collapse
        items={teacherLoad.map((row) => ({
          key: row.teacher_id,
          label: (
            <Space>
              <span>{row.teacher_name}</span>
              <Tag color="blue">{row.total_hours} saat/hafta</Tag>
            </Space>
          ),
          children: (
            <Table
              size="small"
              rowKey="name"
              pagination={false}
              dataSource={row.subjects}
              columns={[
                { title: 'Ders', dataIndex: 'name' },
                { title: 'Haftalık Saat', dataIndex: 'hours' },
              ]}
            />
          ),
        }))}
      />

      <Modal
        title="Yeni Ders Programı Kaydı"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="classroom_id" label="Sınıf" rules={[{ required: true }]} hidden={Boolean(selectedClassroomId)}>
            <Select options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))} />
          </Form.Item>
          <Form.Item name="subject_id" label="Ders" rules={[{ required: true, message: 'Ders seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Ders seçin"
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="teacher_id" label="Öğretmen">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Öğretmen seçin"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="day_of_week" label="Gün" rules={[{ required: true, message: 'Gün seçimi zorunludur' }]}>
            <Select options={DAY_OPTIONS} />
          </Form.Item>
          <Form.Item name="period_no" label="Ders saati" rules={[{ required: true, message: 'Ders saati zorunludur' }]}>
            <Select options={PERIODS.map((p) => ({ value: p, label: `${p}. saat` }))} />
          </Form.Item>
          <Form.Item name="academic_year" label="Eğitim öğretim yılı">
            <Input placeholder="Örn. 2025-2026" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ders Programını Dışa Aktar"
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
        </Form>
      </Modal>
    </AppLayout>
  )
}
