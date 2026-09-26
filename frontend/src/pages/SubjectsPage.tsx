import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { createSubject, deleteSubject, exportSubjects, listSubjects, updateSubject } from '../api/subjects'
import { getErrorMessage } from '../api/client'
import { DIFFICULTY_LEVEL_OPTIONS } from '../types/subject'
import type { Subject, SubjectPayload } from '../types/subject'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

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
  const searchQuery = useDebouncedValue(search)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [form] = Form.useForm<SubjectPayload>()

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
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (row.code || '').toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [rows, searchQuery])

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

  const onBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(
        filteredRows.map((r) => r.id),
        (id) => deleteSubject(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'ders')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportSubjects({
        format: exportFormat,
        filters: searchQuery.trim() ? { q: searchQuery.trim() } : undefined,
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
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Dersler
          </Typography.Title>
          <Space wrap>
            {canDelete && filteredRows.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredRows.length})
              </Button>
            )}
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

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
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
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Dersleri toplu sil"
        description={`Filtreye uyan ${filteredRows.length} ders kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
