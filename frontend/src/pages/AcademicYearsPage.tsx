import { useCallback, useEffect, useState } from 'react'
import { App, Button, DatePicker, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createAcademicYear,
  deleteAcademicYear,
  listAcademicYears,
  updateAcademicYear,
} from '../api/academicYears'
import { getErrorMessage } from '../api/client'
import type { AcademicYear } from '../types/academicYear'

interface FormValues {
  label: string
  range?: [Dayjs, Dayjs] | null
  is_current?: boolean
}

export function AcademicYearsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [rows, setRows] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const canCreate = hasPermission('academic_years.create')
  const canUpdate = hasPermission('academic_years.update')
  const canDelete = hasPermission('academic_years.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listAcademicYears())
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

  const openEdit = (row: AcademicYear) => {
    setEditing(row)
    form.setFieldsValue({
      label: row.label,
      range: row.start_date && row.end_date ? [dayjs(row.start_date), dayjs(row.end_date)] : null,
      is_current: row.is_current,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: FormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = {
        label: values.label,
        start_date: values.range ? values.range[0].format('YYYY-MM-DD') : null,
        end_date: values.range ? values.range[1].format('YYYY-MM-DD') : null,
        is_current: values.is_current,
      }
      if (editing) {
        await updateAcademicYear(editing.id, payload)
        message.success('Eğitim öğretim yılı güncellendi')
      } else {
        await createAcademicYear(session.user.tenant_id, payload)
        message.success('Eğitim öğretim yılı oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSetCurrent = async (row: AcademicYear) => {
    try {
      await updateAcademicYear(row.id, { label: row.label, is_current: true })
      message.success(`${row.label} aktif yıl olarak ayarlandı`)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDelete = (row: AcademicYear) => {
    modal.confirm({
      title: 'Eğitim öğretim yılını sil',
      content: `"${row.label}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteAcademicYear(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<AcademicYear> = [
    { title: 'Eğitim Öğretim Yılı', dataIndex: 'label' },
    { title: 'Başlangıç', dataIndex: 'start_date', render: (v: string | null) => v || '—' },
    { title: 'Bitiş', dataIndex: 'end_date', render: (v: string | null) => v || '—' },
    {
      title: 'Durum',
      render: (_: unknown, record: AcademicYear) =>
        record.is_current ? (
          <Tag color="green">Aktif</Tag>
        ) : (
          canUpdate && (
            <Button size="small" onClick={() => void onSetCurrent(record)}>
              Aktif Yap
            </Button>
          )
        ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: AcademicYear) => (
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
    <AppLayout title="Eğitim Öğretim Yılları">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Eğitim Öğretim Yılları
        </Typography.Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Yeni Yıl
          </Button>
        )}
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? 'Eğitim Öğretim Yılını Düzenle' : 'Yeni Eğitim Öğretim Yılı'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="label" label="Etiket" rules={[{ required: true, message: 'Etiket zorunludur' }]}>
            <Input placeholder="Örn. 2025-2026" />
          </Form.Item>
          <Form.Item name="range" label="Başlangıç / Bitiş">
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
