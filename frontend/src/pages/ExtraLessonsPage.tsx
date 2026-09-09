import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Collapse,
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
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createExtraLesson,
  deleteExtraLesson,
  exportExtraLessons,
  fetchExtraLessonMonthlySummary,
  listExtraLessons,
  suggestLessonLoad,
} from '../api/extraLessons'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { EXTRA_LESSON_CATEGORY_LABELS, EXTRA_LESSON_CATEGORY_OPTIONS } from '../types/extraLesson'
import type { ExtraLessonEntry, ExtraLessonMonthlySummaryRow, ExtraLessonPayload } from '../types/extraLesson'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

const now = new Date()

export function ExtraLessonsPage() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rows, setRows] = useState<ExtraLessonEntry[]>([])
  const [summary, setSummary] = useState<ExtraLessonMonthlySummaryRow[]>([])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [suggestion, setSuggestion] = useState<{ suggested_hours: number; leave_days_in_period: number } | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<ExtraLessonPayload>()

  const canCreate = hasPermission('payroll.create')
  const canDelete = hasPermission('payroll.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherData, rowsData, summaryData] = await Promise.all([
        listTeachers(),
        listExtraLessons({ year, month }),
        fetchExtraLessonMonthlySummary(year, month),
      ])
      setTeachers(teacherData)
      setRows(rowsData)
      setSummary(summaryData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [year, month, message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ year, month })
    setSuggestion(null)
    setModalOpen(true)
  }

  const onSuggest = async () => {
    const teacherId = form.getFieldValue('teacher_id')
    if (!teacherId) {
      message.warning('Önce personel seçin')
      return
    }
    try {
      const result = await suggestLessonLoad(teacherId, year, month)
      setSuggestion(result)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    form.setFieldsValue({ category: 'ders_yuku', hours: suggestion.suggested_hours })
  }

  const onFinish = async (values: ExtraLessonPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createExtraLesson(session.user.tenant_id, values)
      message.success('Ek ders kaydı eklendi')
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (row: ExtraLessonEntry) => {
    try {
      await deleteExtraLesson(row.id)
      message.success('Kayıt silindi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportExtraLessons({ format: exportFormat, year, month })
      downloadBlob(blob, exportFilename('ek-ders-cizelgesi', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<ExtraLessonEntry> = [
    {
      title: 'Personel',
      render: (_: unknown, r: ExtraLessonEntry) => (r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—'),
    },
    { title: 'Kategori', dataIndex: 'category', render: (v: string) => EXTRA_LESSON_CATEGORY_LABELS[v] || v },
    { title: 'Saat', dataIndex: 'hours' },
    { title: 'Not', dataIndex: 'notes', render: (v: string | null) => v || '—' },
    ...(canDelete
      ? [
          {
            title: 'İşlemler',
            width: 80,
            render: (_: unknown, record: ExtraLessonEntry) => (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => void onDelete(record)} />
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Ek Ders ve Ücret Puantajı">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Ek Ders ve Ücret Puantajı
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Select value={year} onChange={setYear} options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))} style={{ width: 100 }} />
          <Select
            value={month}
            onChange={setMonth}
            options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}. Ay` }))}
            style={{ width: 100 }}
          />
        </Space>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni Kayıt
            </Button>
          )}
        </Space>
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} />

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Aylık Özet
      </Typography.Title>
      <Collapse
        items={summary.map((row) => ({
          key: row.teacher_id,
          label: (
            <Space>
              <span>{row.teacher_name}</span>
              <Tag color="blue">{row.total_hours} saat</Tag>
            </Space>
          ),
          children: (
            <Table
              size="small"
              rowKey="name"
              pagination={false}
              dataSource={Object.entries(row.categories).map(([name, hours]) => ({ name, hours }))}
              columns={[
                { title: 'Kategori', dataIndex: 'name', render: (v: string) => EXTRA_LESSON_CATEGORY_LABELS[v] || v },
                { title: 'Saat', dataIndex: 'hours' },
              ]}
            />
          ),
        }))}
      />

      <Modal
        title="Yeni Ek Ders Kaydı"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="teacher_id" label="Personel" rules={[{ required: true, message: 'Personel seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="year" label="Yıl" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="month" label="Ay" rules={[{ required: true }]}>
            <InputNumber min={1} max={12} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category" label="Kategori" rules={[{ required: true, message: 'Kategori zorunludur' }]}>
            <Select options={EXTRA_LESSON_CATEGORY_OPTIONS} />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Button size="small" onClick={() => void onSuggest()}>
              Ders yükünden öner
            </Button>
            {suggestion && (
              <Typography.Text type="secondary">
                Önerilen: {suggestion.suggested_hours} saat
                {suggestion.leave_days_in_period > 0 ? ` (bu ay ${suggestion.leave_days_in_period} gün izinli)` : ''}{' '}
                <a onClick={applySuggestion}>uygula</a>
              </Typography.Text>
            )}
          </Space>
          <Form.Item name="hours" label="Saat" rules={[{ required: true, message: 'Saat zorunludur' }]}>
            <InputNumber min={-500} max={500} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ek Ders Çizelgesini Dışa Aktar"
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
