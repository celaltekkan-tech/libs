import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { createSchool, deleteSchool, listSchools, updateSchool } from '../api/schools'
import { getErrorMessage } from '../api/client'
import { SCHOOL_TYPE_LABELS } from '../types/school'
import type { School, SchoolPayload } from '../types/school'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'

const SCHOOL_TYPE_OPTIONS = Object.entries(SCHOOL_TYPE_LABELS).map(([value, label]) => ({ value, label }))

export function SchoolsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [form] = Form.useForm<SchoolPayload>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSchools(await listSchools())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ school_type: 'lise' })
    setModalOpen(true)
  }

  const openEdit = (school: School) => {
    setEditing(school)
    form.setFieldsValue({ name: school.name, code: school.code, school_type: school.school_type })
    setModalOpen(true)
  }

  const onFinish = async (values: SchoolPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      if (editing) {
        await updateSchool(editing.id, values)
        message.success('Okul güncellendi')
      } else {
        await createSchool(session.user.tenant_id, values)
        message.success('Okul oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (school: School) => {
    modal.confirm({
      title: 'Okulu sil',
      content: `"${school.name}" okulunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteSchool(school.id)
          message.success('Okul silindi')
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
        schools.map((s) => s.id),
        (id) => deleteSchool(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'okul')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const canCreate = hasPermission('schools.create')
  const canUpdate = hasPermission('schools.update')
  const canDelete = hasPermission('schools.delete')

  const columns: ColumnsType<School> = [
    { title: 'Ad', dataIndex: 'name' },
    { title: 'Kod', dataIndex: 'code' },
    {
      title: 'Kademe',
      dataIndex: 'school_type',
      render: (value: School['school_type']) => SCHOOL_TYPE_LABELS[value] ?? value,
    },
    {
      title: 'Oluşturma',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('tr-TR'),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: School) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record)}
                    title="Sil"
                  />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Okullar">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Okullar
          </Typography.Title>
          <Space wrap>
            {canDelete && schools.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({schools.length})
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Okul
              </Button>
            )}
          </Space>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={schools}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? 'Okulu Düzenle' : 'Yeni Okul'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Okul adı" rules={[{ required: true, message: 'Okul adı zorunludur' }]}>
            <Input placeholder="Örn. Atatürk Ortaokulu" />
          </Form.Item>
          <Form.Item name="code" label="Okul kodu" rules={[{ required: true, message: 'Okul kodu zorunludur' }]}>
            <Input placeholder="Örn. ATA-001" />
          </Form.Item>
          <Form.Item
            name="school_type"
            label="Okul kademesi"
            rules={[{ required: true, message: 'Okul kademesi zorunludur' }]}
          >
            <Select options={SCHOOL_TYPE_OPTIONS} placeholder="Kademe seçin" />
          </Form.Item>
        </Form>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Okulları toplu sil"
        description={`Listedeki ${schools.length} okul kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
