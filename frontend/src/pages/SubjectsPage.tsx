import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { createSubject, deleteSubject, exportSubjects, listSubjects, updateSubject } from '../api/subjects'
import {
  createSubjectClassHour,
  deleteSubjectClassHour,
  listSubjectClassHours,
  updateSubjectClassHour,
} from '../api/subjectClassHours'
import { getErrorMessage } from '../api/client'
import { DIFFICULTY_LEVEL_OPTIONS } from '../types/subject'
import type { Subject, SubjectClassHour, SubjectPayload } from '../types/subject'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function SubjectsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [rows, setRows] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<SubjectPayload>()

  const [classHoursSubject, setClassHoursSubject] = useState<Subject | null>(null)
  const [classHours, setClassHours] = useState<SubjectClassHour[]>([])
  const [classHoursLoading, setClassHoursLoading] = useState(false)
  const [classHourForm] = Form.useForm<{ class_level: string; weekly_hours: number }>()

  const canCreate = hasPermission('schedule.create')
  const canUpdate = hasPermission('schedule.update')
  const canDelete = hasPermission('schedule.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listSubjects())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (row.code || '').toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [rows, search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true })
    setModalOpen(true)
  }

  const openEdit = (row: Subject) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      code: row.code || undefined,
      difficulty_level: row.difficulty_level ?? undefined,
      is_active: row.is_active,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: SubjectPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = { ...values, code: values.code || null }
      if (editing) {
        await updateSubject(editing.id, payload)
        message.success('Ders güncellendi')
      } else {
        await createSubject(session.user.tenant_id, payload)
        message.success('Ders oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: Subject) => {
    modal.confirm({
      title: 'Dersi sil',
      content: `"${row.name}" dersini silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteSubject(row.id)
          message.success('Ders silindi')
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
      const blob = await exportSubjects({
        format: exportFormat,
        filters: search.trim() ? { q: search.trim() } : undefined,
      })
      downloadBlob(blob, exportFilename('dersler', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openClassHours = async (row: Subject) => {
    setClassHoursSubject(row)
    setClassHoursLoading(true)
    classHourForm.resetFields()
    try {
      setClassHours(await listSubjectClassHours(row.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setClassHoursLoading(false)
    }
  }

  const onAddClassHour = async (values: { class_level: string; weekly_hours: number }) => {
    if (!session || !classHoursSubject) return
    try {
      await createSubjectClassHour(session.user.tenant_id, { subject_id: classHoursSubject.id, ...values })
      message.success('Saat tanımlandı')
      classHourForm.resetFields()
      setClassHours(await listSubjectClassHours(classHoursSubject.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onUpdateClassHour = async (row: SubjectClassHour, weeklyHours: number) => {
    if (!classHoursSubject) return
    try {
      await updateSubjectClassHour(row.id, weeklyHours)
      setClassHours(await listSubjectClassHours(classHoursSubject.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDeleteClassHour = async (row: SubjectClassHour) => {
    if (!classHoursSubject) return
    try {
      await deleteSubjectClassHour(row.id)
      message.success('Silindi')
      setClassHours(await listSubjectClassHours(classHoursSubject.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<Subject> = [
    { title: 'Ders', dataIndex: 'name' },
    { title: 'Kod', dataIndex: 'code', render: (v: string | null) => v || '—' },
    {
      title: 'Zorluk',
      dataIndex: 'difficulty_level',
      render: (v: string | null) => DIFFICULTY_LEVEL_OPTIONS.find((o) => o.value === v)?.label || '—',
    },
    { title: 'Durum', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Aktif' : 'Pasif') },
    {
      title: 'İşlemler',
      width: 170,
      render: (_: unknown, record: Subject) => (
        <Space>
          <Button size="small" icon={<ClockCircleOutlined />} onClick={() => void openClassHours(record)} title="Sınıf bazlı saatler" />
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

  return (
    <AppLayout title="Dersler">
      <div style={{ maxWidth: 900 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Dersler
          </Typography.Title>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Ders
              </Button>
            )}
          </Space>
        </Space>

        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Ders adı veya kod ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />

        <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredRows} pagination={{ pageSize: 20 }} />
      </div>

      <Modal
        title={editing ? 'Ders Düzenle' : 'Yeni Ders'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Ders adı" rules={[{ required: true, message: 'Ders adı zorunludur' }]}>
            <Input placeholder="Örn. Matematik" />
          </Form.Item>
          <Form.Item name="code" label="Kod">
            <Input placeholder="Örn. MAT" />
          </Form.Item>
          <Form.Item
            name="difficulty_level"
            label="Zorluk derecesi"
            tooltip="Sınav programında ardışık gün zor ders uyarısı için kullanılır"
          >
            <Select allowClear options={DIFFICULTY_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="is_active" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        {editing && (
          <Typography.Text type="secondary">
            Sınıf seviyesine göre haftalık ders saatlerini tanımlamak için listede{' '}
            <ClockCircleOutlined /> simgesini kullanın.
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title={classHoursSubject ? `${classHoursSubject.name} — Sınıf Bazlı Haftalık Saat` : ''}
        open={!!classHoursSubject}
        onCancel={() => setClassHoursSubject(null)}
        footer={<Button onClick={() => setClassHoursSubject(null)}>Kapat</Button>}
      >
        <Typography.Paragraph type="secondary">
          Bu dersin her sınıf seviyesinde kaç saat okutulacağını tanımlayın (örn. 9. sınıf 6 saat, 12.
          sınıf 4 saat). Ders Programı ekranında bu saatlerle karşılaştırma yapılır.
        </Typography.Paragraph>
        <List
          loading={classHoursLoading}
          dataSource={classHours}
          renderItem={(row) => (
            <List.Item
              actions={
                canDelete
                  ? [<Button key="del" size="small" danger icon={<DeleteOutlined />} onClick={() => void onDeleteClassHour(row)} />]
                  : []
              }
            >
              <Space>
                <Typography.Text strong>{row.class_level}. sınıf</Typography.Text>
                <InputNumber
                  min={0}
                  max={60}
                  disabled={!canUpdate}
                  defaultValue={row.weekly_hours}
                  onBlur={(e) => {
                    const v = Number(e.target.value)
                    if (v !== row.weekly_hours && !Number.isNaN(v)) void onUpdateClassHour(row, v)
                  }}
                />
                <Typography.Text type="secondary">saat/hafta</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
        {canCreate && (
          <Form form={classHourForm} layout="inline" onFinish={onAddClassHour} style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
            <Form.Item name="class_level" rules={[{ required: true, message: 'Sınıf seviyesi zorunludur' }]}>
              <Input placeholder="Sınıf (örn. 9)" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="weekly_hours" rules={[{ required: true, message: 'Saat zorunludur' }]}>
              <InputNumber min={0} max={60} placeholder="Saat" style={{ width: 100 }} />
            </Form.Item>
            <Form.Item>
              <Button htmlType="submit" icon={<PlusOutlined />}>
                Ekle
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Ders Listesini Dışa Aktar"
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
            <Input.Group>
              {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((fmt) => (
                <Button
                  key={fmt}
                  type={exportFormat === fmt ? 'primary' : 'default'}
                  onClick={() => setExportFormat(fmt)}
                  style={{ marginRight: 8 }}
                >
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </Input.Group>
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
