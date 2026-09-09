import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createLeaveRecord,
  deleteLeaveRecord,
  exportLeaveRecords,
  fetchLeaveSummary,
  listLeaveRecords,
  updateLeaveRecord,
} from '../api/leaves'
import { listTeachers, updateTeacher } from '../api/teachers'
import { LeaveCalendarView } from '../components/LeaveCalendarView'
import { getErrorMessage } from '../api/client'
import { LEAVE_QUOTA_SOURCE_LABELS, LEAVE_TYPE_LABELS, LEAVE_TYPE_OPTIONS } from '../types/leaveRecord'
import type { LeaveRecord, LeaveSummary } from '../types/leaveRecord'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

interface LeaveFormValues {
  teacher_id: number
  leave_type: string
  range: [dayjs.Dayjs, dayjs.Dayjs]
  reason?: string
}

export function LeavesPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<LeaveRecord[]>([])
  const [summary, setSummary] = useState<LeaveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [quotaDraft, setQuotaDraft] = useState<number | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<LeaveFormValues>()

  const canCreate = hasPermission('leaves.create')
  const canUpdate = hasPermission('leaves.update')
  const canDelete = hasPermission('leaves.delete')

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listTeachers()
      setTeachers(data)
      if (data.length > 0) setSelectedTeacherId(data[0].id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadTeachers()
  }, [loadTeachers])

  const loadForTeacher = useCallback(async () => {
    if (!selectedTeacherId) {
      setRows([])
      setSummary(null)
      return
    }
    setRowsLoading(true)
    try {
      const [rowsData, summaryData] = await Promise.all([
        listLeaveRecords({ teacher_id: selectedTeacherId, year }),
        fetchLeaveSummary(selectedTeacherId, year),
      ])
      setRows(rowsData)
      setSummary(summaryData)
      setQuotaDraft(summaryData.annual_leave_quota)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setRowsLoading(false)
    }
  }, [selectedTeacherId, year, message])

  useEffect(() => {
    void loadForTeacher()
  }, [loadForTeacher])

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || null,
    [teachers, selectedTeacherId],
  )

  const openCreate = () => {
    if (!selectedTeacherId) return
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ teacher_id: selectedTeacherId })
    setModalOpen(true)
  }

  const openEdit = (row: LeaveRecord) => {
    setEditing(row)
    form.setFieldsValue({
      teacher_id: row.teacher_id,
      leave_type: row.leave_type,
      range: [dayjs(row.start_date), dayjs(row.end_date)],
      reason: row.reason || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: LeaveFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = {
        teacher_id: values.teacher_id,
        leave_type: values.leave_type,
        start_date: values.range[0].format('YYYY-MM-DD'),
        end_date: values.range[1].format('YYYY-MM-DD'),
        reason: values.reason || null,
      }
      if (editing) {
        await updateLeaveRecord(editing.id, payload)
        message.success('İzin kaydı güncellendi')
      } else {
        await createLeaveRecord(session.user.tenant_id, payload)
        message.success('İzin kaydı oluşturuldu')
      }
      setModalOpen(false)
      void loadForTeacher()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: LeaveRecord) => {
    modal.confirm({
      title: 'İzin kaydını sil',
      content: 'Bu izin kaydını silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteLeaveRecord(row.id)
          message.success('İzin kaydı silindi')
          void loadForTeacher()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onSaveQuota = async () => {
    if (!selectedTeacherId) return
    setSubmitting(true)
    try {
      await updateTeacher(selectedTeacherId, { annual_leave_quota: quotaDraft })
      message.success('Yıllık izin hakkı güncellendi')
      void loadForTeacher()
      void loadTeachers()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportLeaveRecords({
        format: exportFormat,
        filters: selectedTeacherId ? { teacher_id: selectedTeacherId, year } : { year },
      })
      downloadBlob(blob, exportFilename('izin-kayitlari', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<LeaveRecord> = [
    { title: 'İzin Türü', dataIndex: 'leave_type', render: (v: string) => LEAVE_TYPE_LABELS[v] || v },
    { title: 'Başlangıç', dataIndex: 'start_date' },
    { title: 'Bitiş', dataIndex: 'end_date' },
    { title: 'Gün', dataIndex: 'day_count' },
    { title: 'Açıklama', dataIndex: 'reason', render: (v: string | null) => v || '—' },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: LeaveRecord) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const personnelTab = (
    <>
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select
            value={selectedTeacherId ?? undefined}
            onChange={setSelectedTeacherId}
            placeholder="Personel seçin"
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            style={{ width: 240 }}
          />
          <InputNumber value={year} onChange={(v) => setYear(Number(v) || year)} style={{ width: 100 }} />
        </Space>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
          {canCreate && selectedTeacherId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni İzin Kaydı
            </Button>
          )}
        </Space>
      </Space>

      {selectedTeacher && summary && (
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 24, maxWidth: 800 }}>
          <Descriptions.Item label="Personel">
            {selectedTeacher.first_name} {selectedTeacher.last_name}
          </Descriptions.Item>
          <Descriptions.Item label="Yıllık izin hakkı (manuel override)">
            <Space>
              <InputNumber
                min={0}
                max={365}
                placeholder="Otomatik"
                value={quotaDraft ?? undefined}
                onChange={(v) => setQuotaDraft(v == null ? null : Number(v))}
                disabled={!canUpdate}
                style={{ width: 90 }}
              />
              {canUpdate && (
                <Button size="small" onClick={() => void onSaveQuota()} loading={submitting}>
                  Kaydet
                </Button>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Uygulanan kota" span={2}>
            <Tag>{summary.annual_leave_quota} gün</Tag>
            <Typography.Text type="secondary">
              {LEAVE_QUOTA_SOURCE_LABELS[summary.annual_leave_quota_source]}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Kullanılan yıllık izin">{summary.totals.yillik || 0} gün</Descriptions.Item>
          <Descriptions.Item label="Kalan yıllık izin">
            <Tag color={summary.remaining_annual_leave < 0 ? 'red' : 'green'}>
              {summary.remaining_annual_leave} gün
            </Tag>
          </Descriptions.Item>
          {LEAVE_TYPE_OPTIONS.filter((o) => o.value !== 'yillik').map((o) => (
            <Descriptions.Item label={o.label} key={o.value}>
              {summary.totals[o.value] || 0} gün
            </Descriptions.Item>
          ))}
        </Descriptions>
      )}

      <Table rowKey="id" loading={rowsLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} />
    </>
  )

  return (
    <AppLayout title="Personel İzin Takibi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Personel İzin Takibi
      </Typography.Title>

      <Tabs
        items={[
          { key: 'personnel', label: 'Personel Bazlı', children: personnelTab },
          { key: 'calendar', label: 'Takvim', children: <LeaveCalendarView /> },
        ]}
      />

      <Modal
        title={editing ? 'İzin Kaydını Düzenle' : 'Yeni İzin Kaydı'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="teacher_id" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="leave_type" label="İzin türü" rules={[{ required: true, message: 'İzin türü zorunludur' }]}>
            <Select options={LEAVE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="range" label="Tarih aralığı" rules={[{ required: true, message: 'Tarih aralığı zorunludur' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Açıklama">
            <Input.TextArea rows={2} placeholder="Opsiyonel açıklama" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="İzin Kayıtlarını Dışa Aktar"
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
