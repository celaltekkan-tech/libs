import { useCallback, useEffect, useState } from 'react'
import { App, Button, Empty, Input, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import { EyeInvisibleOutlined, EyeOutlined, MailOutlined, MessageOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { getErrorMessage } from '../api/client'
import { hideMessageLog, listMessageLogs, unhideMessageLog } from '../api/messageLogs'
import type {
  MessageLog,
  MessageLogChannel,
  MessageLogStatus,
} from '../types/messageLog'
import { SOURCE_MODULE_LABELS, STATUS_LABELS } from '../types/messageLog'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function formatDate(iso: string | null) {
  return iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '—'
}

function statusTag(status: MessageLogStatus) {
  switch (status) {
    case 'basarili':
      return <Tag color="green">Başarılı</Tag>
    case 'basarisiz':
      return <Tag color="red">Başarısız</Tag>
    default:
      return <Tag>İptal</Tag>
  }
}

function channelTag(channel: MessageLogChannel) {
  return channel === 'sms' ? (
    <Tag icon={<MessageOutlined />} color="blue">
      SMS
    </Tag>
  ) : (
    <Tag icon={<MailOutlined />} color="purple">
      E-posta
    </Tag>
  )
}

export function MessageLogsPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'visible' | 'hidden'>('visible')
  const [channel, setChannel] = useState<MessageLogChannel | 'all'>('all')
  const [status, setStatus] = useState<MessageLogStatus | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listMessageLogs({
        view,
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        q: search || undefined,
        page,
        pageSize,
      })
      setRows(result.data)
      setTotal(result.pagination.total)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, view, channel, status, search, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search])

  const onHide = async (row: MessageLog) => {
    try {
      await hideMessageLog(row.id)
      message.success('Kayıt gizlendi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onUnhide = async (row: MessageLog) => {
    try {
      await unhideMessageLog(row.id)
      message.success('Kayıt geri alındı')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<MessageLog> = [
    {
      title: 'Kanal',
      dataIndex: 'channel',
      width: 110,
      render: (c: MessageLogChannel) => channelTag(c),
    },
    {
      title: 'Kaynak',
      dataIndex: 'source_module',
      render: (m: string) => SOURCE_MODULE_LABELS[m] || m,
    },
    {
      title: 'Alıcı',
      render: (_: unknown, row) => (
        <Space direction="vertical" size={0}>
          <span>{row.recipient_label || '—'}</span>
          {row.recipient_contact && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.recipient_contact}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Konu / İçerik',
      render: (_: unknown, row) => (
        <Tooltip title={row.body || ''}>
          <span>{row.subject || row.body?.slice(0, 60) || '—'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Durum',
      render: (_: unknown, row) => (
        <Space direction="vertical" size={0}>
          {statusTag(row.status)}
          {row.error && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {row.error}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'İşlemler',
      width: 100,
      render: (_: unknown, row) =>
        view === 'visible' ? (
          <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => void onHide(row)} title="Gizle" />
        ) : (
          <Button size="small" icon={<EyeOutlined />} onClick={() => void onUnhide(row)} title="Geri al" />
        ),
    },
  ]

  return (
    <AppLayout title="SMS / E-posta Kayıtları">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          SMS / E-posta Kayıtları
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Sistem tarafından gönderilen SMS ve e-postaların salt okunur kaydı. Bir kaydı gizlemek yalnızca kendi
          görünümünüzden kaldırır; diğer kullanıcıları etkilemez.
        </Typography.Paragraph>

        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Space wrap>
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v as 'visible' | 'hidden')
                setPage(1)
              }}
              options={[
                { label: 'Kayıtlar', value: 'visible' },
                { label: 'Gizlenenler', value: 'hidden' },
              ]}
            />
            <Segmented
              value={channel}
              onChange={(v) => {
                setChannel(v as MessageLogChannel | 'all')
                setPage(1)
              }}
              options={[
                { label: 'Tümü', value: 'all' },
                { label: 'SMS', value: 'sms' },
                { label: 'E-posta', value: 'email' },
              ]}
            />
            <Select
              value={status}
              style={{ width: 140 }}
              onChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
              options={[
                { label: 'Tüm durumlar', value: 'all' },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Input.Search
              placeholder="Alıcı, konu veya içerikte ara"
              allowClear
              style={{ width: 260 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(v) => setSearchInput(v)}
            />
          </Space>
        </Space>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: <Empty description="Kayıt yok" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </AppLayout>
  )
}
