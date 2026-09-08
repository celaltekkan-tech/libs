import { useCallback, useEffect, useState } from 'react'
import { App, Button, Layout, Select, Space, Table, Tag, Typography } from 'antd'
import { CheckOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppHeader } from '../../components/AppHeader'
import { deleteFeedback, listFeedback, updateFeedbackStatus } from '../../api/feedback'
import { getErrorMessage } from '../../api/client'
import type { Feedback, FeedbackStatus } from '../../types/feedback'

const STATUS_LABEL: Record<FeedbackStatus, { text: string; color: string }> = {
  new: { text: 'Yeni', color: 'blue' },
  read: { text: 'Okundu', color: 'gold' },
  resolved: { text: 'Çözüldü', color: 'green' },
}

export function FeedbackListPage() {
  const { message, modal } = App.useApp()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | undefined>(undefined)

  const load = useCallback(
    async (status?: FeedbackStatus) => {
      setLoading(true)
      try {
        setFeedbacks(await listFeedback(status ? { status } : undefined))
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    void load(statusFilter)
  }, [load, statusFilter])

  const changeStatus = async (id: number, status: FeedbackStatus) => {
    try {
      await updateFeedbackStatus(id, status)
      message.success('Durum güncellendi')
      void load(statusFilter)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const remove = (id: number) => {
    modal.confirm({
      title: 'Geri bildirimi sil',
      content: 'Bu geri bildirimi silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteFeedback(id)
          message.success('Geri bildirim silindi')
          void load(statusFilter)
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<Feedback> = [
    {
      title: 'Hesap',
      dataIndex: ['Tenant', 'name'],
      render: (_: unknown, record) => record.Tenant?.name || `#${record.tenant_id}`,
    },
    {
      title: 'Gönderen',
      render: (_: unknown, record) =>
        record.User ? `${record.User.full_name} (${record.User.email})` : 'Silinmiş kullanıcı',
    },
    { title: 'Mesaj', dataIndex: 'message', ellipsis: true },
    {
      title: 'Durum',
      dataIndex: 'status',
      width: 120,
      render: (status: FeedbackStatus) => (
        <Tag color={STATUS_LABEL[status].color}>{STATUS_LABEL[status].text}</Tag>
      ),
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString('tr-TR'),
    },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record) => (
        <Space>
          {record.status !== 'read' && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => void changeStatus(record.id, 'read')}
              title="Okundu olarak işaretle"
            />
          )}
          {record.status !== 'resolved' && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={() => void changeStatus(record.id, 'resolved')}
              title="Çözüldü olarak işaretle"
            />
          )}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(record.id)} title="Sil" />
        </Space>
      ),
    },
  ]

  return (
    <Layout className="app-shell">
      <AppHeader title="Geri Bildirimler" />

      <Layout.Content className="app-content" style={{ maxWidth: 1200 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Geri Bildirimler
          </Typography.Title>
          <Select
            allowClear
            placeholder="Durum filtrele"
            style={{ width: 200 }}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { value: 'new', label: 'Yeni' },
              { value: 'read', label: 'Okundu' },
              { value: 'resolved', label: 'Çözüldü' },
            ]}
          />
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={feedbacks}
          pagination={{ pageSize: 20 }}
        />
      </Layout.Content>
    </Layout>
  )
}
