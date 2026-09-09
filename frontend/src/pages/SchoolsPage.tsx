import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { createSchool, deleteSchool, listSchools, updateSchool } from '../api/schools'
import { getErrorMessage } from '../api/client'
import type { School, SchoolPayload } from '../types/school'

export function SchoolsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
    setModalOpen(true)
  }

  const openEdit = (school: School) => {
    setEditing(school)
    form.setFieldsValue({ name: school.name, code: school.code })
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

  const canCreate = hasPermission('schools.create')
  const canUpdate = hasPermission('schools.update')
  const canDelete = hasPermission('schools.delete')

  const columns: ColumnsType<School> = [
    { title: 'Ad', dataIndex: 'name' },
    { title: 'Kod', dataIndex: 'code' },
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
      <div style={{ maxWidth: 900 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Okullar
          </Typography.Title>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni Okul
            </Button>
          )}
        </Space>

        <Table rowKey="id" loading={loading} columns={columns} dataSource={schools} pagination={{ pageSize: 20 }} />
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
            <Input placeholder="Örn. Atatürk Anadolu Lisesi" />
          </Form.Item>
          <Form.Item name="code" label="Okul kodu" rules={[{ required: true, message: 'Okul kodu zorunludur' }]}>
            <Input placeholder="Örn. ATA-001" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
