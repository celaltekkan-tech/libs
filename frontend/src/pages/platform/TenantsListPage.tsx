import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Popconfirm, Space, Tabs, Tag } from 'antd'
import { SortableTable } from '../../components/SortableTable'
import { PlusOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { listTenants, runDemoReset } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { TenantListItem } from '../../types/tenant'
import { CreateTenantWizardModal } from './CreateTenantWizardModal'
import { BannedAccountsPanel } from './BannedAccountsPanel'
import { tablePagination } from '../../utils/tablePagination'

export function TenantsListPage() {
  const { message } = App.useApp()
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [resettingDemo, setResettingDemo] = useState(false)
  const [bannedCount, setBannedCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTenants(await listTenants())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ColumnsType<TenantListItem> = [
    {
      title: 'Hesap adı',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Space size={8}>
          <Link to={`/platform/tenants/${record.id}`}>{name}</Link>
          {record.is_demo ? <Tag color="gold">Demo</Tag> : null}
        </Space>
      ),
    },
    { title: 'Plan', dataIndex: 'plan', render: (plan: string | null) => plan || '—' },
    {
      title: 'Telefon',
      dataIndex: 'phone',
      render: (phone: string | null | undefined) => phone || '—',
    },
    {
      title: 'Durum',
      dataIndex: 'is_active',
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Aktif</Tag> : <Tag color="red">Askıda</Tag>,
    },
    {
      title: 'Geri bildirim',
      dataIndex: 'feedback_enabled',
      render: (enabled: boolean | undefined) =>
        enabled ? <Tag color="blue">Açık</Tag> : <Tag>Kapalı</Tag>,
    },
    { title: 'Okul', dataIndex: 'school_count', align: 'right' },
    { title: 'Kullanıcı', dataIndex: 'user_count', align: 'right' },
    {
      title: 'Son giriş',
      dataIndex: 'last_login_at',
      render: (value: string | null | undefined) =>
        value ? new Date(value).toLocaleString('tr-TR') : '—',
    },
    {
      title: 'Oluşturma',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('tr-TR'),
    },
    {
      title: '',
      key: 'demo-reset',
      width: 120,
      render: (_value, record) =>
        record.is_demo ? (
          <Popconfirm
            title="Demo hesabı başlangıç haline dönsün mü?"
            description="Müşteri adaylarının yaptığı değişiklikler silinir. Eksik kayıtlar örnek veriyle tamamlanır."
            okText="Geri al"
            cancelText="Vazgeç"
            onConfirm={() => void resetDemo()}
          >
            <Button size="small" danger icon={<UndoOutlined />} loading={resettingDemo}>
              Geri al
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  async function resetDemo() {
    setResettingDemo(true)
    try {
      const result = await runDemoReset()
      const extra = result.added.length ? ` Eklenen: ${result.added.join(', ')}.` : ''
      message.success(
        result.restored
          ? `Demo hesabı başlangıç haline döndü.${extra}`
          : `Demo hesabının başlangıç görüntüsü oluşturuldu.${extra}`,
      )
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setResettingDemo(false)
    }
  }

  const tenantsTab = (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Yeni Hesap
        </Button>
      </Space>

      <SortableTable
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tenants}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
      />
    </>
  )

  return (
    <AppLayout title="Hesap Yönetimi">
      <div style={{ width: '100%' }}>
        <Tabs
          items={[
            { key: 'accounts', label: 'Hesaplar', children: tenantsTab },
            {
              key: 'banned',
              label: bannedCount === null ? 'Banlı Hesaplar' : `Banlı Hesaplar (${bannedCount})`,
              children: <BannedAccountsPanel onCountChange={setBannedCount} />,
            },
          ]}
        />
      </div>

      <CreateTenantWizardModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false)
          void load()
        }}
      />
    </AppLayout>
  )
}
