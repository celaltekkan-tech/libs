import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, IdcardOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { AppLayout } from '../../components/AppLayout'
import { SortableDashboard } from '../../components/SortableDashboard'
import { useAuth } from '../../auth/AuthContext'
import {
  getTenant,
  listTenantSchools,
  listTenantUsers,
  resetTenantTwoFactor,
  resetTenantUserTwoFactor,
  updateTenant,
  updateTenantUser,
} from '../../api/tenants'
import { listLicenses } from '../../api/licenses'
import { getErrorMessage } from '../../api/client'
import type { Tenant, TenantSchool, TenantUser, UpdateTenantUserPayload } from '../../types/tenant'
import type { License } from '../../types/license'

interface EditUserForm {
  full_name: string
  email: string
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const tenantId = Number(id)
  const { message } = App.useApp()
  const { session } = useAuth()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [schools, setSchools] = useState<TenantSchool[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [toggling2fa, setToggling2fa] = useState(false)
  const [resetting2fa, setResetting2fa] = useState(false)
  const [resettingUserId, setResettingUserId] = useState<number | null>(null)
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [editForm] = Form.useForm<EditUserForm>()

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

  async function handleToggle2fa(checked: boolean) {
    setToggling2fa(true)
    try {
      const updated = await updateTenant(tenantId, { two_factor_enabled: checked })
      setTenant(updated)
      if (!checked) {
        setUsers((prev) => prev.map((user) => ({ ...user, totp_enabled: false })))
      }
      message.success(
        checked
          ? 'İki adımlı doğrulama hesap için açıldı'
          : 'İki adımlı doğrulama kapatıldı ve kullanıcı 2FA ayarları sıfırlandı',
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setToggling2fa(false)
    }
  }

  async function handleResetAll2fa() {
    setResetting2fa(true)
    try {
      const result = await resetTenantTwoFactor(tenantId)
      setUsers((prev) => prev.map((user) => ({ ...user, totp_enabled: false })))
      message.success(
        result.reset_user_count > 0
          ? `${result.reset_user_count} kullanıcının 2FA ayarı sıfırlandı`
          : 'Sıfırlanacak 2FA kaydı yoktu',
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setResetting2fa(false)
    }
  }

  async function handleResetUser2fa(userId: number) {
    setResettingUserId(userId)
    try {
      await resetTenantUserTwoFactor(tenantId, userId)
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, totp_enabled: false } : user)),
      )
      message.success('Kullanıcının 2FA ayarı sıfırlandı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setResettingUserId(null)
    }
  }

  function openEditUser(user: TenantUser) {
    setEditingUser(user)
    editForm.setFieldsValue({
      full_name: user.full_name,
      email: user.email,
    })
  }

  function closeEditUser() {
    setEditingUser(null)
    editForm.resetFields()
  }

  async function handleSaveUser(values: EditUserForm) {
    if (!editingUser) return
    setSavingUser(true)
    try {
      const payload: UpdateTenantUserPayload = {
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
      }
      const updated = await updateTenantUser(tenantId, editingUser.id, payload)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                full_name: updated.full_name,
                email: updated.email,
              }
            : user,
        ),
      )
      message.success('Kullanıcı bilgileri güncellendi')
      closeEditUser()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingUser(false)
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

          <SortableDashboard
            layoutKey={`platform-tenant-detail:${session?.user.id ?? 0}`}
            widgets={[
              {
                id: 'tenant-summary',
                span: { xs: 24, md: 12 },
                node: (
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
                ),
              },
              {
                id: 'tenant-2fa',
                span: { xs: 24 },
                node: (
                  <Card
                    loading={loading}
                    title={
                      <Space>
                        <SafetyCertificateOutlined />
                        İki adımlı doğrulama (2FA)
                      </Space>
                    }
                  >
                    {tenant && (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          Hesap için 2FA özelliğini açıp kapatabilir veya kilitlenen kullanıcılar için 2FA
                          kurulumlarını sıfırlayabilirsiniz. Kapatma işlemi tüm kullanıcı 2FA ayarlarını da
                          temizler.
                        </Typography.Paragraph>
                        <Space wrap>
                          <Switch
                            checked={Boolean(tenant.two_factor_enabled)}
                            loading={toggling2fa}
                            checkedChildren="Açık"
                            unCheckedChildren="Kapalı"
                            onChange={(checked) => void handleToggle2fa(checked)}
                          />
                          <Popconfirm
                            title="Tüm kullanıcıların 2FA ayarları sıfırlansın mı?"
                            description="Özellik açık kalır; kullanıcılar yeniden kurulum yapmalıdır."
                            okText="Sıfırla"
                            cancelText="Vazgeç"
                            onConfirm={() => void handleResetAll2fa()}
                          >
                            <Button danger loading={resetting2fa}>
                              Tüm kullanıcı 2FA sıfırla
                            </Button>
                          </Popconfirm>
                        </Space>
                      </Space>
                    )}
                  </Card>
                ),
              },
              {
                id: 'tenant-license',
                span: { xs: 24, md: 12 },
                node: (
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
                          {activeLicense.ends_at
                            ? new Date(activeLicense.ends_at).toLocaleDateString('tr-TR')
                            : 'Süresiz'}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Tag color="red">Aktif lisans yok</Tag>
                    )}
                  </Card>
                ),
              },
              {
                id: 'tenant-schools',
                span: { xs: 24 },
                node: (
                  <Card title="Okullar" loading={loading}>
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={schools}
                      scroll={{ x: 'max-content' }}
                      columns={[
                        { title: 'Ad', dataIndex: 'name' },
                        { title: 'Kod', dataIndex: 'code' },
                      ]}
                    />
                  </Card>
                ),
              },
              {
                id: 'tenant-users',
                span: { xs: 24 },
                node: (
                  <Card title="Kullanıcılar" loading={loading}>
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={users}
                      scroll={{ x: 'max-content' }}
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
                        {
                          title: '2FA',
                          dataIndex: 'totp_enabled',
                          render: (enabled: boolean | undefined) =>
                            enabled ? <Tag color="blue">Açık</Tag> : <Tag>Kapalı</Tag>,
                        },
                        {
                          title: 'İşlem',
                          key: 'actions',
                          render: (_: unknown, record: TenantUser) => (
                            <Space wrap>
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => openEditUser(record)}
                              >
                                Düzenle
                              </Button>
                              <Popconfirm
                                title={`${record.full_name} için 2FA sıfırlansın mı?`}
                                okText="Sıfırla"
                                cancelText="Vazgeç"
                                disabled={!record.totp_enabled}
                                onConfirm={() => void handleResetUser2fa(record.id)}
                              >
                                <Button
                                  size="small"
                                  danger
                                  disabled={!record.totp_enabled}
                                  loading={resettingUserId === record.id}
                                >
                                  2FA sıfırla
                                </Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </Space>
      </div>

      <Modal
        title="Kullanıcı bilgilerini düzenle"
        open={Boolean(editingUser)}
        onCancel={closeEditUser}
        onOk={() => editForm.submit()}
        confirmLoading={savingUser}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={(values) => void handleSaveUser(values)}>
          <Form.Item
            name="full_name"
            label="Ad soyad"
            rules={[
              { required: true, message: 'Ad soyad zorunludur' },
              { min: 2, message: 'En az 2 karakter' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-posta (giriş adı)"
            rules={[
              { required: true, message: 'E-posta zorunludur' },
              { type: 'email', message: 'Geçerli bir e-posta girin' },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
