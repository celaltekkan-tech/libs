import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Descriptions,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { ArrowLeftOutlined, IdcardOutlined } from '@ant-design/icons'
import { AppLayout } from '../../components/AppLayout'
import { getTenant, listTenantSchools, listTenantUsers, updateTenant } from '../../api/tenants'
import { listLicenses } from '../../api/licenses'
import { getErrorMessage } from '../../api/client'
import type { Tenant, TenantSchool, TenantUser } from '../../types/tenant'
import type { License } from '../../types/license'

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const tenantId = Number(id)
  const { message } = App.useApp()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [schools, setSchools] = useState<TenantSchool[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingStatus, setTogglingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tenantData, schoolData, userData, licenseData] = await Promise.all([
        getTenant(tenantId),
        listTenantSchools(tenantId),
        listTenantUsers(tenantId),
        listLicenses({ tenant_id: tenantId }),
      ])
      setTenant(tenantData)
      setSchools(schoolData)
      setUsers(userData)
      setLicenses(licenseData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [tenantId, message])

  const activeLicense = licenses.find((license) => license.status === 'active')

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
    <AppLayout title="Hesap Yönetimi">
      <div style={{ maxWidth: 1100 }}>
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

          <Card
            loading={loading}
            title="Lisans"
            extra={
              <Link to="/platform/licenses">
                <Button size="small" icon={<IdcardOutlined />}>
                  Lisans Yönetimine git
                </Button>
              </Link>
            }
          >
            {activeLicense ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Plan">{activeLicense.plan}</Descriptions.Item>
                <Descriptions.Item label="Durum">
                  <Tag color="green">Aktif</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Başlangıç">
                  {new Date(activeLicense.starts_at).toLocaleDateString('tr-TR')}
                </Descriptions.Item>
                <Descriptions.Item label="Bitiş">
                  {activeLicense.ends_at ? new Date(activeLicense.ends_at).toLocaleDateString('tr-TR') : 'Süresiz'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Tag color="red">Aktif lisans yok</Tag>
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
      </div>
    </AppLayout>
  )
}
