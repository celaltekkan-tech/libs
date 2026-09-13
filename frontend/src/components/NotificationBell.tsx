import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Empty, List, Popover, Space, Typography } from 'antd'
import { BellOutlined, CheckOutlined } from '@ant-design/icons'
import {
  fetchUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications'
import { getErrorMessage } from '../api/client'
import type { AppNotification } from '../types/notification'
import { App } from 'antd'

const POLL_MS = 60_000

export function NotificationBell() {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [shakeTick, setShakeTick] = useState(0)

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await fetchUnreadNotificationCount())
    } catch {
      /* sessiz — oturum/ağ hataları header'ı bozmasın */
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listMyNotifications())
      await refreshCount()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, refreshCount])

  useEffect(() => {
    void refreshCount()
    const id = window.setInterval(() => void refreshCount(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshCount])

  // Okunmamış varken dakikada bir kısa sallanma
  useEffect(() => {
    if (unread <= 0) return
    const id = window.setInterval(() => setShakeTick((n) => n + 1), POLL_MS)
    return () => window.clearInterval(id)
  }, [unread])

  useEffect(() => {
    if (open) void loadList()
  }, [open, loadList])

  const onOpenChange = (next: boolean) => setOpen(next)

  const onMarkOne = async (id: number) => {
    try {
      await markNotificationRead(id)
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)),
      )
      setUnread((c) => Math.max(0, c - 1))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
      setUnread(0)
      message.success('Tüm bildirimler okundu')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const content = (
    <div className="notification-popover">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Text strong>Bildirimler</Typography.Text>
        {unread > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => void onMarkAll()}>
            Tümünü okundu say
          </Button>
        )}
      </Space>
      <List
        loading={loading}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bildirim yok" /> }}
        dataSource={items}
        style={{ maxHeight: 360, overflowY: 'auto' }}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            className={item.read_at ? 'notification-item is-read' : 'notification-item is-unread'}
            onClick={() => {
              if (!item.read_at) void onMarkOne(item.id)
            }}
            style={{ cursor: item.read_at ? 'default' : 'pointer', alignItems: 'flex-start' }}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Typography.Text strong={!item.read_at}>{item.title}</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                ellipsis={{ rows: 3 }}
              >
                {item.body}
              </Typography.Paragraph>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString('tr-TR')}
                {item.Sender ? ` · ${item.Sender.full_name}` : ''}
              </Typography.Text>
            </Space>
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      placement="bottomRight"
      arrow
    >
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          className={unread > 0 ? 'notification-bell has-unread' : 'notification-bell'}
          data-shake={shakeTick}
          icon={<BellOutlined />}
          aria-label={unread > 0 ? `${unread} okunmamış bildirim` : 'Bildirimler'}
          title="Bildirimler"
        />
      </Badge>
    </Popover>
  )
}
