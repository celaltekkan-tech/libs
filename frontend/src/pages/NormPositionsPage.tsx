import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Progress, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createNormPosition,
  deleteNormPosition,
  listNormPositions,
  updateNormPosition,
} from '../api/normPositions'
import { listSchools } from '../api/schools'
import { getErrorMessage } from '../api/client'
import type { NormPosition, NormPositionPayload } from '../types/normPosition'
import type { School } from '../types/school'

export function NormPositionsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission, hasModule } = useAuth()
  const [rows, setRows] = useState<NormPosition[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NormPosition | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<NormPositionPayload>()

  const canSchools = hasModule('schools')
  const canCreate = hasPermission('norm_positions.create')
  const canUpdate = hasPermission('norm_positions.update')
  const canDelete = hasPermission('norm_positions.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rowsData, schoolData] = await Promise.all([
        listNormPositions(),
        canSchools ? listSchools().catch(() => []) : Promise.resolve([]),
      ])
      setRows(rowsData)
      setSchools(schoolData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canSchools, message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (row: NormPosition) => {
    setEditing(row)
    form.setFieldsValue({
      school_id: row.school_id,
      title_branch: row.title_branch,
      quota_count: row.quota_count,
      notes: row.notes || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: NormPositionPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = { ...values, school_id: values.school_id || null, notes: values.notes || null }
      if (editing) {
        await updateNormPosition(editing.id, payload)
        message.success('Norm kadro güncellendi')
      } else {
        await createNormPosition(session.user.tenant_id, payload)
        message.success('Norm kadro oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: NormPosition) => {
    modal.confirm({
      title: 'Norm kadroyu sil',
      content: `"${row.title_branch}" norm kadrosunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteNormPosition(row.id)
          message.success('Norm kadro silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<NormPosition> = [
    { title: 'Unvan / Branş', dataIndex: 'title_branch' },
    ...(canSchools
      ? [{ title: 'Okul', render: (_: unknown, record: NormPosition) => record.School?.name || 'Tüm okullar' }]
      : []),
    { title: 'Kadro Sayısı', dataIndex: 'quota_count' },
    { title: 'Dolu', dataIndex: 'filled_count' },
    { title: 'Boş', dataIndex: 'vacant_count' },
    {
      title: 'Doluluk',
      render: (_: unknown, record: NormPosition) =>
        record.occupancy_rate == null ? (
          '—'
        ) : (
          <Progress
            percent={record.occupancy_rate}
            size="small"
            status={record.occupancy_rate > 100 ? 'exception' : 'active'}
          />
        ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: NormPosition) => (
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

  return (
    <AppLayout title="Norm Kadro Takibi">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Norm Kadro Takibi
        </Typography.Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Yeni Norm Kadro
          </Button>
        )}
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? 'Norm Kadroyu Düzenle' : 'Yeni Norm Kadro'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {canSchools && (
            <Form.Item name="school_id" label="Okul">
              <Select
                allowClear
                placeholder="Tüm okullar (boş bırakılırsa)"
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="title_branch"
            label="Unvan / Branş"
            rules={[{ required: true, message: 'Unvan/branş zorunludur' }]}
          >
            <Input placeholder="Örn. Matematik Öğretmeni, Memur" />
          </Form.Item>
          <Form.Item
            name="quota_count"
            label="Kadro sayısı"
            rules={[{ required: true, message: 'Kadro sayısı zorunludur' }]}
          >
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
