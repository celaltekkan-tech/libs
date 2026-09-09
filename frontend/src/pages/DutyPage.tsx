import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createDutyAssignment,
  createDutyLocation,
  deleteDutyAssignment,
  deleteDutyLocation,
  exportDuty,
  fetchDutyFairness,
  generateDutyRoster,
  listDutyAssignments,
  listDutyLocations,
} from '../api/duty'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { DutyAssignment, DutyFairnessReport, DutyLocation } from '../types/duty'
import type { Teacher } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function DutyPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [locations, setLocations] = useState<DutyLocation[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<DutyAssignment[]>([])
  const [fairness, setFairness] = useState<DutyFairnessReport>({ by_teacher: [], by_location: [] })
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs().add(6, 'day')])

  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')

  const [locationForm] = Form.useForm<{ name: string }>()
  const [generateForm] = Form.useForm<{
    range: [dayjs.Dayjs, dayjs.Dayjs]
    duty_location_ids: number[]
    include_weekends?: boolean
  }>()
  const [assignForm] = Form.useForm<{
    teacher_id: number
    duty_location_id: number
    duty_date: dayjs.Dayjs
  }>()

  const canCreate = hasPermission('duty.create')
  const canDelete = hasPermission('duty.delete')

  const startDate = range[0].format('YYYY-MM-DD')
  const endDate = range[1].format('YYYY-MM-DD')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [locationData, teacherData, assignmentData, fairnessData] = await Promise.all([
        listDutyLocations(),
        listTeachers(),
        listDutyAssignments({ start_date: startDate, end_date: endDate }),
        fetchDutyFairness({ start_date: startDate, end_date: endDate }),
      ])
      setLocations(locationData)
      setTeachers(teacherData)
      setAssignments(assignmentData)
      setFairness(fairnessData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, message])

  useEffect(() => {
    void load()
  }, [load])

  const onCreateLocation = async (values: { name: string }) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createDutyLocation(session.user.tenant_id, values)
      message.success('Nöbet yeri oluşturuldu')
      setLocationModalOpen(false)
      locationForm.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteLocation = (loc: DutyLocation) => {
    modal.confirm({
      title: 'Nöbet yerini sil',
      content: `"${loc.name}" konumunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteDutyLocation(loc.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onGenerate = async (values: {
    range: [dayjs.Dayjs, dayjs.Dayjs]
    duty_location_ids: number[]
    include_weekends?: boolean
  }) => {
    if (!session) return
    setSubmitting(true)
    try {
      const result = await generateDutyRoster(session.user.tenant_id, {
        start_date: values.range[0].format('YYYY-MM-DD'),
        end_date: values.range[1].format('YYYY-MM-DD'),
        duty_location_ids: values.duty_location_ids,
        include_weekends: values.include_weekends,
      })
      message.success(`${result.created} nöbet ataması oluşturuldu${result.skipped.length ? `, ${result.skipped.length} atlandı` : ''}`)
      setGenerateModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onAssign = async (values: { teacher_id: number; duty_location_id: number; duty_date: dayjs.Dayjs }) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createDutyAssignment(session.user.tenant_id, {
        teacher_id: values.teacher_id,
        duty_location_id: values.duty_location_id,
        duty_date: values.duty_date.format('YYYY-MM-DD'),
      })
      message.success('Nöbet ataması eklendi')
      setAssignModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteAssignment = (row: DutyAssignment) => {
    modal.confirm({
      title: 'Nöbet atamasını sil',
      content: 'Bu atamayı silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteDutyAssignment(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
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

  const assignmentColumns: ColumnsType<DutyAssignment> = useMemo(
    () => [
      { title: 'Tarih', dataIndex: 'duty_date' },
      { title: 'Nöbet Yeri', render: (_: unknown, r: DutyAssignment) => r.DutyLocation?.name || '—' },
      {
        title: 'Öğretmen',
        render: (_: unknown, r: DutyAssignment) => (r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—'),
      },
      ...(canDelete
        ? [
            {
              title: 'İşlemler',
              width: 80,
              render: (_: unknown, record: DutyAssignment) => (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteAssignment(record)} />
              ),
            },
          ]
        : []),
    ],
    [canDelete],
  )

  return (
    <AppLayout title="Dönüşümlü Nöbet Programı">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Dönüşümlü Nöbet Programı
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
          format="DD.MM.YYYY"
        />
        <Space wrap>
          <Button onClick={() => setLocationModalOpen(true)}>Nöbet Yerleri</Button>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
          {canCreate && (
            <Button onClick={() => setGenerateModalOpen(true)}>Otomatik Oluştur</Button>
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssignModalOpen(true)}>
              Manuel Ekle
            </Button>
          )}
        </Space>
      </Space>

      <Tabs
        items={[
          {
            key: 'assignments',
            label: 'Nöbet Çizelgesi',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                columns={assignmentColumns}
                dataSource={assignments}
                pagination={{ pageSize: 20 }}
              />
            ),
          },
          {
            key: 'fairness',
            label: 'Adalet / Denge Raporu',
            children: (
              <Space size="large" align="start" wrap>
                <div>
                  <Typography.Text strong>Öğretmen bazında</Typography.Text>
                  <Table
                    size="small"
                    rowKey="teacher_id"
                    pagination={false}
                    dataSource={fairness.by_teacher}
                    columns={[
                      { title: 'Öğretmen', dataIndex: 'teacher_name' },
                      { title: 'Nöbet Sayısı', dataIndex: 'count' },
                    ]}
                  />
                </div>
                <div>
                  <Typography.Text strong>Yer bazında</Typography.Text>
                  <Table
                    size="small"
                    rowKey="duty_location_id"
                    pagination={false}
                    dataSource={fairness.by_location}
                    columns={[
                      { title: 'Nöbet Yeri', dataIndex: 'name' },
                      { title: 'Nöbet Sayısı', dataIndex: 'count' },
                    ]}
                  />
                </div>
              </Space>
            ),
          },
        ]}
      />

      <Modal title="Nöbet Yerleri" open={locationModalOpen} onCancel={() => setLocationModalOpen(false)} footer={null}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {locations.map((loc) => (
            <Space key={loc.id} style={{ width: '100%', justifyContent: 'space-between' }}>
              <Tag>{loc.name}</Tag>
              {canDelete && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteLocation(loc)} />
              )}
            </Space>
          ))}
          {canCreate && (
            <Form form={locationForm} layout="inline" onFinish={onCreateLocation} style={{ marginTop: 12 }}>
              <Form.Item name="name" rules={[{ required: true, message: 'Ad zorunludur' }]}>
                <Input placeholder="Yeni nöbet yeri adı" />
              </Form.Item>
              <Form.Item>
                <Button htmlType="submit" loading={submitting}>
                  Ekle
                </Button>
              </Form.Item>
            </Form>
          )}
        </Space>
      </Modal>

      <Modal
        title="Otomatik Nöbet Programı Oluştur"
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={() => generateForm.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          Seçilen tarih aralığında, izinli olmayan öğretmenler arasında en az nöbet tutana öncelik
          verilerek adil bir dağılım yapılır. Mevcut atamalar korunur.
        </Typography.Paragraph>
        <Form form={generateForm} layout="vertical" onFinish={onGenerate} initialValues={{ range }}>
          <Form.Item name="range" label="Tarih aralığı" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item
            name="duty_location_ids"
            label="Nöbet yerleri"
            rules={[{ required: true, message: 'En az bir nöbet yeri seçin' }]}
          >
            <Select
              mode="multiple"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              placeholder="Nöbet yerlerini seçin"
            />
          </Form.Item>
          <Form.Item name="include_weekends" valuePropName="checked">
            <Checkbox>Hafta sonlarını dahil et</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Manuel Nöbet Ataması"
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={() => assignForm.submit()}
        confirmLoading={submitting}
        okText="Ekle"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={assignForm} layout="vertical" onFinish={onAssign}>
          <Form.Item name="teacher_id" label="Öğretmen" rules={[{ required: true, message: 'Öğretmen seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="duty_location_id" label="Nöbet yeri" rules={[{ required: true, message: 'Nöbet yeri seçimi zorunludur' }]}>
            <Select options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          </Form.Item>
          <Form.Item name="duty_date" label="Tarih" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Nöbet Çizelgesini Dışa Aktar"
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
