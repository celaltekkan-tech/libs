import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Space, Tag, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { SortableTable } from '../components/SortableTable'
import { useAuth } from '../auth/AuthContext'
import {
  approveMobileRegisterRequest,
  listMobileRegisterRequests,
  rejectMobileRegisterRequest,
} from '../api/mobileRegisterRequests'
import { getErrorMessage } from '../api/client'
import type { MobileRegisterRequest } from '../types/mobileRegisterRequest'
import { tablePagination } from '../utils/tablePagination'

const EASY_WORDS = ['elma', 'okul', 'kedi', 'masa', 'sari', 'mavi', 'topu', 'evim']

function suggestEasyPassword() {
  const word = EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)]
  const digits = String(10 + Math.floor(Math.random() * 90))
  return `${word}${digits}`
}

function statusTag(status: MobileRegisterRequest['status']) {
  if (status === 'pending') return <Tag color="gold">Bekliyor</Tag>
  if (status === 'approved') return <Tag color="green">Onaylandı</Tag>
  return <Tag color="red">Reddedildi</Tag>
}

export function MobileRegisterRequestsPage() {
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<MobileRegisterRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [current, setCurrent] = useState<MobileRegisterRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approveForm] = Form.useForm<{ password: string }>()
  const [rejectForm] = Form.useForm<{ reason?: string }>()

  const canUpdate = hasPermission('mobile_register_requests.update')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listMobileRegisterRequests())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const openApprove = (row: MobileRegisterRequest) => {
    setCurrent(row)
    approveForm.setFieldsValue({ password: suggestEasyPassword() })
    setApproveOpen(true)
  }

  const openReject = (row: MobileRegisterRequest) => {
    setCurrent(row)
    rejectForm.resetFields()
    setRejectOpen(true)
  }

  const onApprove = async (values: { password: string }) => {
    if (!current) return
    setSubmitting(true)
    try {
      await approveMobileRegisterRequest(current.id, values.password)
      message.success('Kayıt onaylandı. Öğretmene T.C. ve bu şifreyi söyleyin.')
      setApproveOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onReject = async (values: { reason?: string }) => {
    if (!current) return
    setSubmitting(true)
    try {
      await rejectMobileRegisterRequest(current.id, values.reason)
      message.success('Kayıt isteği reddedildi')
      setRejectOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<MobileRegisterRequest> = useMemo(
    () => [
      { title: 'Ad soyad', dataIndex: 'full_name' },
      { title: 'T.C.', dataIndex: 'national_id', width: 130 },
      { title: 'Telefon', dataIndex: 'phone', width: 140 },
      { title: 'Okul', dataIndex: 'school_name' },
      {
        title: 'Durum',
        dataIndex: 'status',
        width: 120,
        render: (status: MobileRegisterRequest['status']) => statusTag(status),
      },
      {
        title: 'Tarih',
        dataIndex: 'created_at',
        width: 170,
        render: (value: string) => new Date(value).toLocaleString('tr-TR'),
      },
      ...(canUpdate
        ? [
            {
              title: 'İşlemler',
              width: 180,
              render: (_: unknown, record: MobileRegisterRequest) =>
                record.status === 'pending' ? (
                  <Space>
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApprove(record)}>
                      Onayla
                    </Button>
                    <Button size="small" danger icon={<CloseOutlined />} onClick={() => openReject(record)}>
                      Reddet
                    </Button>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    {record.reviewed_by_name || '—'}
                    {record.reject_reason ? ` · ${record.reject_reason}` : ''}
                  </Typography.Text>
                ),
            },
          ]
        : []),
    ],
    [canUpdate],
  )

  return (
    <AppLayout title="Mobil Kayıt İstekleri">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Mobil Kayıt İstekleri
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Uygulamadan gelen öğretmen kayıt isteklerini onaylayın. Onaylarken şifreyi siz belirlersiniz; öğretmen T.C.
          kimlik numarası ve bu şifreyle girer. Onayda öğretmen kaydındaki telefon da güncellenir.
        </Typography.Paragraph>

        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Yenile
          </Button>
        </Space>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={current ? `Onayla: ${current.full_name}` : 'Onayla'}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() => approveForm.submit()}
        confirmLoading={submitting}
        okText="Onayla ve şifreyi kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Typography.Paragraph>
          Öğretmen T.C. <b>{current?.national_id}</b> ve aşağıda yazdığınız şifreyle giriş yapacak. Kolay bir şifre
          önerdik; isterseniz değiştirin.
        </Typography.Paragraph>
        <Form form={approveForm} layout="vertical" onFinish={onApprove}>
          <Form.Item
            name="password"
            label="Şifre"
            extra="En az 6 karakter, 1 harf ve 1 rakam."
            rules={[
              { required: true, message: 'Şifre zorunludur' },
              { min: 6, message: 'En az 6 karakter' },
              {
                validator: async (_, value) => {
                  const text = String(value || '')
                  if (!text) return
                  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text) || !/\d/.test(text)) {
                    throw new Error('En az 1 harf ve 1 rakam olmalı')
                  }
                },
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button onClick={() => approveForm.setFieldsValue({ password: suggestEasyPassword() })}>
            Yeni kolay şifre öner
          </Button>
        </Form>
      </Modal>

      <Modal
        title={current ? `Reddet: ${current.full_name}` : 'Reddet'}
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        confirmLoading={submitting}
        okText="Reddet"
        okButtonProps={{ danger: true }}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={rejectForm} layout="vertical" onFinish={onReject}>
          <Form.Item name="reason" label="Gerekçe (isteğe bağlı)">
            <Input.TextArea rows={3} maxLength={400} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
