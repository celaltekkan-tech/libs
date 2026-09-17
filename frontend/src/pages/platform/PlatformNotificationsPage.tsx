import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Radio, Select, Space, Typography } from 'antd'
import { SortableTable } from '../../components/SortableTable'
import { PlusOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { createNotification, listNotificationRecipientOptions, listSentNotifications } from '../../api/notifications'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { AppNotification, CreateNotificationPayload, NotificationTargetType } from '../../types/notification'
import type { TenantListItem } from '../../types/tenant'
import { tablePagination } from '../../utils/tablePagination'

interface ManagedUserOption {
  id: number
  full_name: string
  email: string
  tenant_id: number
}

export function PlatformNotificationsPage() {
  const { message } = App.useApp()
  const [sent, setSent] = useState<AppNotification[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [users, setUsers] = useState<ManagedUserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<CreateNotificationPayload>()
  const targetType = Form.useWatch('target_type', form) as NotificationTargetType | undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sentData, tenantData] = await Promise.all([listSentNotifications(), listTenants()])
      setSent(sentData)
      setTenants(tenantData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const loadTenantUsers = async (tenantId: number) => {
    try {
      setUsers(await listNotificationRecipientOptions(tenantId))
    } catch {
      setUsers([])
    }
  }

  const onSend = async (values: CreateNotificationPayload) => {
    setSubmitting(true)
    try {
      const result = await createNotification({
        title: values.title.trim(),
        body: values.body.trim(),
        target_type: values.target_type,
        tenant_id: values.target_type === 'tenant' ? values.tenant_id : undefined,
        user_ids: values.target_type === 'users' ? values.user_ids : undefined,
      })
      message.success(`${result.count} alıcıya bildirim gönderildi`)
      setOpen(false)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<AppNotification> = [
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('tr-TR'),
    },
    { title: 'Başlık', dataIndex: 'title' },
    {
      title: 'Alıcı',
      render: (_: unknown, r: AppNotification) =>
        r.Recipient ? `${r.Recipient.full_name} (${r.Recipient.email || '—'})` : '—',
    },
    {
      title: 'Hesap',
      render: (_: unknown, r: AppNotification) => r.Tenant?.name || '—',
    },
    {
      title: 'Okundu',
      width: 90,
      render: (_: unknown, r: AppNotification) => (r.read_at ? 'Evet' : 'Hayır'),
    },
  ]

  return (
    <AppLayout title="Bildirimler">
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Bildirimler
          </Typography.Title>
          <Typography.Text type="secondary">
            Tenant hesaplarına veya seçili kullanıcılara panel bildirimi gönderin.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldsValue({ target_type: 'tenant' })
            setOpen(true)
          }}
        >
          Yeni bildirim
        </Button>
      </Space>

      <SortableTable
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={sent}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title="Bildirim gönder"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Gönder"
        okButtonProps={{ icon: <SendOutlined /> }}
        cancelText="Vazgeç"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onSend} initialValues={{ target_type: 'tenant' }}>
          <Form.Item name="title" label="Başlık" rules={[{ required: true, message: 'Başlık zorunlu' }]}>
            <Input maxLength={200} placeholder="Örn. Bakım duyurusu" />
          </Form.Item>
          <Form.Item name="body" label="Mesaj" rules={[{ required: true, message: 'Mesaj zorunlu' }]}>
            <Input.TextArea rows={4} maxLength={5000} placeholder="Bildirim metni" />
          </Form.Item>
          <Form.Item name="target_type" label="Hedef" rules={[{ required: true }]}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'tenant', label: 'Tek hesap' },
                { value: 'users', label: 'Seçili kullanıcılar' },
                { value: 'all_tenants', label: 'Tüm hesaplar' },
              ]}
              onChange={() => {
                form.setFieldsValue({ tenant_id: undefined, user_ids: undefined })
                setUsers([])
              }}
            />
          </Form.Item>
          {(targetType === 'tenant' || targetType === 'users') && (
            <Form.Item
              name="tenant_id"
              label="Hesap (tenant)"
              rules={[{ required: true, message: 'Hesap seçin' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={tenants.map((t) => ({ value: t.id, label: t.name }))}
                onChange={(id) => {
                  form.setFieldsValue({ user_ids: undefined })
                  if (targetType === 'users') void loadTenantUsers(id)
                }}
              />
            </Form.Item>
          )}
          {targetType === 'users' && (
            <Form.Item
              name="user_ids"
              label="Kullanıcılar"
              rules={[{ required: true, message: 'En az bir kullanıcı seçin' }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder={users.length ? 'Kullanıcı seçin' : 'Önce hesap seçin'}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.full_name} (${u.email})`,
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </AppLayout>
  )
}
