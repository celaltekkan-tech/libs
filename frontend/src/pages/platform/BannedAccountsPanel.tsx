import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Empty, Popconfirm, Space, Tag, Typography } from 'antd'
import { ReloadOutlined, UnlockOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { SortableTable } from '../../components/SortableTable'
import { listBannedAccounts, unlockTenantUserLogin } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { BannedAccount } from '../../types/tenant'
import { tablePagination } from '../../utils/tablePagination'

const REFRESH_MS = 30000

function formatRemaining(until: string | null) {
  if (!until) return '—'
  const diff = new Date(until).getTime() - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) return 'Süre doldu'
  const totalSeconds = Math.ceil(diff / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} dk ${seconds} sn` : `${seconds} sn`
}

interface BannedAccountsPanelProps {
  onCountChange?: (count: number) => void
}

export function BannedAccountsPanel({ onCountChange }: BannedAccountsPanelProps) {
  const { message } = App.useApp()
  const [accounts, setAccounts] = useState<BannedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [unbanningUserId, setUnbanningUserId] = useState<number | null>(null)
  const [, setTick] = useState(0)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const rows = await listBannedAccounts()
        setAccounts(rows)
        onCountChange?.(rows.length)
      } catch (err) {
        if (!silent) message.error(getErrorMessage(err))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [message, onCountChange],
  )

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!accounts.length) return
    const timer = window.setInterval(() => {
      setTick((value) => value + 1)
      setAccounts((prev) => {
        const next = prev.filter(
          (item) => !item.banned_until || new Date(item.banned_until).getTime() > Date.now(),
        )
        if (next.length === prev.length) return prev
        onCountChange?.(next.length)
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [accounts.length, onCountChange])

  async function handleUnban(record: BannedAccount) {
    setUnbanningUserId(record.user_id)
    try {
      await unlockTenantUserLogin(record.tenant_id, record.user_id)
      setAccounts((prev) => {
        const next = prev.filter((item) => item.user_id !== record.user_id)
        onCountChange?.(next.length)
        return next
      })
      message.success(`Ban kaldırıldı: ${record.full_name}`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setUnbanningUserId(null)
    }
  }

  const columns: ColumnsType<BannedAccount> = [
    {
      title: 'Hesap adı',
      dataIndex: 'tenant_name',
      render: (name: string | null, record) => (
        <Link to={`/platform/tenants/${record.tenant_id}`}>{name || `#${record.tenant_id}`}</Link>
      ),
    },
    {
      title: 'Kullanıcı',
      dataIndex: 'full_name',
      render: (fullName: string, record) => (
        <Space direction="vertical" size={0}>
          <span>{fullName}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.email}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Banlanma saati',
      dataIndex: 'banned_at',
      render: (value: string | null) => (value ? new Date(value).toLocaleString('tr-TR') : '—'),
    },
    {
      title: 'Ban kalan süresi',
      dataIndex: 'banned_until',
      render: (value: string | null) => <Tag color="red">{formatRemaining(value)}</Tag>,
    },
    {
      title: 'IP adresi',
      dataIndex: 'ip_address',
      render: (value: string | null) => value || '—',
    },
    {
      title: '',
      key: 'unban',
      width: 150,
      render: (_value, record) => (
        <Popconfirm
          title={`${record.full_name} için ban kaldırılsın mı?`}
          description="Kullanıcı hemen giriş yapabilir. Şifresi değişmez."
          okText="Banı kaldır"
          cancelText="Vazgeç"
          onConfirm={() => void handleUnban(record)}
        >
          <Button size="small" icon={<UnlockOutlined />} loading={unbanningUserId === record.user_id}>
            Banı kaldır
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">
          Çok sayıda hatalı giriş denemesi yüzünden geçici olarak banlanan kullanıcılar listelenir.
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          Yenile
        </Button>
      </Space>

      <SortableTable
        rowKey="user_id"
        loading={loading}
        columns={columns}
        dataSource={accounts}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="Banlı hesap yok" /> }}
      />
    </Space>
  )
}
