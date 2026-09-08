import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Layout, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppHeader } from '../../components/AppHeader'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { TenantListItem } from '../../types/tenant'
import { CreateTenantWizardModal } from './CreateTenantWizardModal'

export function TenantsListPage() {
  const { message } = App.useApp()
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

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
      render: (name: string, record) => <Link to={`/platform/tenants/${record.id}`}>{name}</Link>,
    },
    { title: 'Plan', dataIndex: 'plan', render: (plan: string | null) => plan || '—' },
    {
      title: 'Durum',
      dataIndex: 'is_active',
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Aktif</Tag> : <Tag color="red">Askıda</Tag>,
    },
    { title: 'Okul', dataIndex: 'school_count', align: 'right' },
    { title: 'Kullanıcı', dataIndex: 'user_count', align: 'right' },
    {
      title: 'Oluşturma',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('tr-TR'),
    },
  ]

  return (
    <Layout className="app-shell">
      <AppHeader title="Hesap Yönetimi" />

      <Layout.Content className="app-content" style={{ maxWidth: 1100 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Hesaplar
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Yeni Hesap
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tenants}
          pagination={{ pageSize: 20 }}
        />
      </Layout.Content>

      <CreateTenantWizardModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false)
          void load()
        }}
      />
    </Layout>
  )
}
