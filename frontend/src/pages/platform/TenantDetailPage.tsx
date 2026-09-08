import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Descriptions,
  Layout,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { AppHeader } from '../../components/AppHeader'
import { getTenant, listTenantSchools, listTenantUsers, updateTenant } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { Tenant, TenantSchool, TenantUser } from '../../types/tenant'

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const tenantId = Number(id)
  const { message } = App.useApp()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [schools, setSchools] = useState<TenantSchool[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingStatus, setTogglingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tenantData, schoolData, userData] = await Promise.all([
        getTenant(tenantId),
        listTenantSchools(tenantId),
        listTenantUsers(tenantId),
      ])
      setTenant(tenantData)
      setSchools(schoolData)
      setUsers(userData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [tenantId, message])

  useEffect(() => {
    if (Number.isFinite(tenantId)) void load()
  }, [tenantId, load])

  async function handleToggleActive(checked: boolean) {
    setTogglingStatus(true)
    try {
      const updated = await updateTenant(tenantId, { is_active: checked })
      setTenant(updated)
      message.success(checked ? 'Hesap aktifleştirildi' : 'Hesap askıya alındı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTogglingStatus(false)
    }
  }

  return (
    <Layout className="app-shell">
      <AppHeader title="Hesap Yönetimi" />

      <Layout.Content className="app-content" style={{ maxWidth: 1100 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Link to="/platform/tenants">
            <Button icon={<ArrowLeftOutlined />} type="text">
              Hesaplara dön
            </Button>
          </Link>

          <Card loading={loading} title={tenant?.name || 'Hesap'}>
            {tenant && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Plan">{tenant.plan || '—'}</Descriptions.Item>
                <Descriptions.Item label="Durum">
                  <Space>
                    <Switch
                      checked={tenant.is_active}
                      loading={togglingStatus}
                      onChange={(checked) => void handleToggleActive(checked)}
                    />
                    {tenant.is_active ? <Tag color="green">Aktif</Tag> : <Tag color="red">Askıda</Tag>}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Oluşturma">
                  {new Date(tenant.created_at).toLocaleString('tr-TR')}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          <Card title="Okullar" loading={loading}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={schools}
              columns={[
                { title: 'Ad', dataIndex: 'name' },
                { title: 'Kod', dataIndex: 'code' },
              ]}
            />
          </Card>

          <Card title="Kullanıcılar" loading={loading}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={users}
              columns={[
                { title: 'Ad soyad', dataIndex: 'full_name' },
                { title: 'E-posta', dataIndex: 'email' },
                { title: 'Rol', dataIndex: 'role' },
                {
                  title: 'Durum',
                  dataIndex: 'is_active',
                  render: (isActive: boolean) =>
                    isActive ? <Tag color="green">Aktif</Tag> : <Tag color="red">Pasif</Tag>,
                },
              ]}
            />
          </Card>
        </Space>
      </Layout.Content>
    </Layout>
  )
}
