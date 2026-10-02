import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Space, Switch, Tag, Typography } from 'antd'
import { SortableTable } from '../../components/SortableTable'
import { ArrowLeftOutlined, CommentOutlined, EditOutlined, IdcardOutlined, SafetyCertificateOutlined, UnlockOutlined } from '@ant-design/icons'
import { AppLayout } from '../../components/AppLayout'
import { SortableDashboard } from '../../components/SortableDashboard'
import { useAuth } from '../../auth/AuthContext'
import {
  getTenant,
  listTenantSchools,
  listTenantUsers,
  resetTenantTwoFactor,
  resetTenantUserPassword,
  resetTenantUserTwoFactor,
  resetTenantUserSmsLogin,
  unlockTenantUserLogin,
  updateTenant,
  updateTenantSchoolName,
  updateTenantUser,
} from '../../api/tenants'
import { listLicenses } from '../../api/licenses'
import { getErrorMessage } from '../../api/client'
import { isAddonPlan, isAiPlan, isSmsPlan } from '../../constants/licensePlans'
import type { Tenant, TenantSchool, TenantUser, UpdateTenantUserPayload } from '../../types/tenant'
import type { License } from '../../types/license'
import { MOBILE_PHONE_RULE, requiredMobilePhoneRule } from '../../utils/phone'

interface EditUserForm {
  full_name: string
  email: string
  phone?: string
}

interface ResetPasswordForm {
  password: string
  confirm_password: string
}

interface TenantContactForm {
  phone?: string
}

interface SchoolNameForm {
  name: string
}

function isLoginLocked(user: TenantUser) {
  if (!user.login_locked_until) return false
  return new Date(user.login_locked_until).getTime() > Date.now()
}

function hasLoginLock(user: TenantUser) {
  return isLoginLocked(user) || Number(user.login_failed_count || 0) > 0
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
  const [togglingSmsLogin, setTogglingSmsLogin] = useState(false)
  const [togglingFeedback, setTogglingFeedback] = useState(false)
  const [resetting2fa, setResetting2fa] = useState(false)
  const [resettingUserId, setResettingUserId] = useState<number | null>(null)
  const [resettingSmsUserId, setResettingSmsUserId] = useState<number | null>(null)
  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null)
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<TenantUser | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [editingSchool, setEditingSchool] = useState<TenantSchool | null>(null)
  const [savingSchoolName, setSavingSchoolName] = useState(false)
  const [editForm] = Form.useForm<EditUserForm>()
  const [passwordForm] = Form.useForm<ResetPasswordForm>()
  const [contactForm] = Form.useForm<TenantContactForm>()
  const [schoolNameForm] = Form.useForm<SchoolNameForm>()

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
      contactForm.setFieldsValue({ phone: tenantData.phone || undefined })
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [tenantId, message, contactForm])

  function openResetPassword(user: TenantUser) {
    setPasswordUser(user)
    passwordForm.resetFields()
  }

  function closeResetPassword() {
    setPasswordUser(null)
    passwordForm.resetFields()
  }

  async function handleResetPassword(values: ResetPasswordForm) {
    if (!passwordUser) return
    setSavingPassword(true)
    try {
      await resetTenantUserPassword(tenantId, passwordUser.id, values.password)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === passwordUser.id
            ? { ...user, login_failed_count: 0, login_locked_until: null }
            : user,
        ),
      )
      message.success(`${passwordUser.full_name} için şifre sıfırlandı`)
      closeResetPassword()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingPassword(false)
    }
  }

  const activeLicense = licenses.find((license) => license.status === 'active' && !isAddonPlan(license.plan))
  const activeSmsLicense = licenses.find((license) => license.status === 'active' && isSmsPlan(license.plan))
  const activeAiLicense = licenses.find((license) => license.status === 'active' && isAiPlan(license.plan))

  useEffect(() => {
    if (Number.isFinite(tenantId)) void load()
  }, [tenantId, load])

  async function handleSaveTenantPhone(values: TenantContactForm) {
    setSavingPhone(true)
    try {
      const { tenant: updated, usersPhoneSynced } = await updateTenant(tenantId, {
        phone: values.phone?.trim() || null,
      })
      setTenant(updated)
      if (usersPhoneSynced > 0) {
        const userData = await listTenantUsers(tenantId)
        setUsers(userData)
        message.success(
          `Kurum telefonu kaydedildi; ${usersPhoneSynced} kullanıcının telefonu güncellendi`,
        )
      } else {
        message.success('Kurum telefonu kaydedildi')
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingPhone(false)
    }
  }

  async function handleToggleActive(checked: boolean) {
    setTogglingStatus(true)
    try {
      const { tenant: updated } = await updateTenant(tenantId, { is_active: checked })
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
      const { tenant: updated } = await updateTenant(tenantId, { two_factor_enabled: checked })
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

  async function handleToggleFeedback(checked: boolean) {
    setTogglingFeedback(true)
    try {
      const { tenant: updated } = await updateTenant(tenantId, { feedback_enabled: checked })
      setTenant(updated)
      message.success(checked ? 'Geri bildirim bu hesap için açıldı' : 'Geri bildirim bu hesap için kapatıldı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTogglingFeedback(false)
    }
  }

  async function handleToggleSmsLogin(checked: boolean) {
    setTogglingSmsLogin(true)
    try {
      const { tenant: updated } = await updateTenant(tenantId, { sms_login_enabled: checked })
      setTenant(updated)
      if (checked) {
        const userData = await listTenantUsers(tenantId)
        setUsers(userData)
      }
      message.success(checked ? 'SMS ile giriş açıldı' : 'SMS ile giriş kapatıldı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTogglingSmsLogin(false)
    }
  }

  async function handleResetUserSms(userId: number) {
    setResettingSmsUserId(userId)
    try {
      await resetTenantUserSmsLogin(tenantId, userId)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                sms_login_requests_count: 0,
                sms_login_requests_date: null,
                login_failed_count: 0,
                login_locked_until: null,
              }
            : user,
        ),
      )
      message.success('SMS giriş istek sayacı ve kilit sıfırlandı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setResettingSmsUserId(null)
    }
  }

  async function handleUnlockUserLogin(userId: number) {
    setUnlockingUserId(userId)
    try {
      await unlockTenantUserLogin(tenantId, userId)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, login_failed_count: 0, login_locked_until: null }
            : user,
        ),
      )
      message.success('Giriş kilidi kaldırıldı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setUnlockingUserId(null)
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

  function openEditSchool(school: TenantSchool) {
    setEditingSchool(school)
    schoolNameForm.setFieldsValue({ name: school.name })
  }

  function closeEditSchool() {
    setEditingSchool(null)
    schoolNameForm.resetFields()
  }

  async function handleSaveSchoolName(values: SchoolNameForm) {
    if (!editingSchool) return
    const name = values.name.trim()
    setSavingSchoolName(true)
    try {
      const { school, tenantName } = await updateTenantSchoolName(tenantId, editingSchool.id, name)
      setSchools((prev) =>
        prev.map((item) => (item.id === editingSchool.id ? { ...item, name: school.name } : item)),
      )
      if (tenantName) {
        setTenant((prev) => (prev ? { ...prev, name: tenantName } : prev))
      }
      message.success('Okul adı kaydedildi')
      closeEditSchool()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingSchoolName(false)
    }
  }

  function openEditUser(user: TenantUser) {
    setEditingUser(user)
    editForm.setFieldsValue({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || undefined,
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
        phone: values.phone?.trim() || null,
      }
      const updated = await updateTenantUser(tenantId, editingUser.id, payload)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                full_name: updated.full_name,
                email: updated.email,
                phone: updated.phone ?? null,
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
      <div style={{ width: '100%' }}>
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
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        {schools.length === 1 && (
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditSchool(schools[0])}
                          >
                            Okul adını düzenle
                          </Button>
                        )}
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Plan">
                            {activeLicense?.plan || 'Aktif lisans yok'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Kurum telefonu">
                            {tenant.phone || '—'}
                          </Descriptions.Item>
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
                          <Descriptions.Item label="Son giriş">
                            {tenant.last_login_at
                              ? new Date(tenant.last_login_at).toLocaleString('tr-TR')
                              : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Oluşturma">
                            {new Date(tenant.created_at).toLocaleString('tr-TR')}
                          </Descriptions.Item>
                        </Descriptions>
                        <Form
                          form={contactForm}
                          layout="vertical"
                          onFinish={(values) => void handleSaveTenantPhone(values)}
                          style={{ maxWidth: 360 }}
                        >
                          <Form.Item
                            name="phone"
                            label="Kurum telefonu"
                            extra="Telefonu olmayan aktif kullanıcılara da kopyalanır (05xxxxxxxxx)."
                            style={{ marginBottom: 8 }}
                            rules={[MOBILE_PHONE_RULE]}
                          >
                            <Input placeholder="05xx xxx xx xx" maxLength={30} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={savingPhone}>
                            Kurum telefonunu kaydet
                          </Button>
                        </Form>
                      </Space>
                    )}
                  </Card>
                ),
              },
              {
                id: 'tenant-2fa',
                label: 'Hesap güvenliği',
                span: { xs: 24 },
                node: (
                  <Card
                    loading={loading}
                    title={
                      <Space>
                        <SafetyCertificateOutlined />
                        Hesap güvenliği (2FA / SMS)
                      </Space>
                    }
                  >
                    {tenant && (
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          Authenticator 2FA veya SMS ile giriş ikinci adımını açabilirsiniz. SMS
                          girişi için aktif SMS 3000 / SMS 10000 lisansı ve her kullanıcının kendi
                          cep telefonu gerekir; kurum telefonu kaydedildiğinde telefonu boş olan
                          kullanıcılara otomatik kopyalanır. Günlük SMS istek limiti 3’tür.
                          Öğretmen kayıt SMS’i bu lisansa bağlı değildir.
                        </Typography.Paragraph>
                        <Space wrap>
                          <Switch
                            checked={Boolean(tenant.two_factor_enabled)}
                            loading={toggling2fa}
                            checkedChildren="2FA açık"
                            unCheckedChildren="2FA kapalı"
                            onChange={(checked) => void handleToggle2fa(checked)}
                          />
                          <Switch
                            checked={Boolean(tenant.sms_login_enabled)}
                            loading={togglingSmsLogin}
                            disabled={!tenant.sms_login_enabled && !activeSmsLicense}
                            checkedChildren="SMS giriş açık"
                            unCheckedChildren="SMS giriş kapalı"
                            onChange={(checked) => void handleToggleSmsLogin(checked)}
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
                id: 'tenant-feedback',
                span: { xs: 24, md: 12 },
                node: (
                  <Card
                    loading={loading}
                    title={
                      <Space>
                        <CommentOutlined />
                        Geri bildirim
                      </Space>
                    }
                  >
                    {tenant && (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          Kapalıyken bu hesabın kullanıcıları menüde geri bildirimi görmez ve
                          gönderemez. Yalnızca açtığınız hesaplar kullanır.
                        </Typography.Paragraph>
                        <Switch
                          checked={Boolean(tenant.feedback_enabled)}
                          loading={togglingFeedback}
                          checkedChildren="Açık"
                          unCheckedChildren="Kapalı"
                          onChange={(checked) => void handleToggleFeedback(checked)}
                        />
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
                    <Typography.Paragraph strong style={{ marginTop: 16, marginBottom: 8 }}>
                      SMS eklentisi
                    </Typography.Paragraph>
                    {activeSmsLicense ? (
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Plan">{activeSmsLicense.plan}</Descriptions.Item>
                        <Descriptions.Item label="Kota">
                          {activeSmsLicense.sms_quota == null
                            ? 'Sınırsız'
                            : activeSmsLicense.sms_used != null
                              ? `${activeSmsLicense.sms_used.toLocaleString('tr-TR')} / ${activeSmsLicense.sms_quota.toLocaleString('tr-TR')}`
                              : activeSmsLicense.sms_quota.toLocaleString('tr-TR')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Bitiş">
                          {activeSmsLicense.ends_at
                            ? new Date(activeSmsLicense.ends_at).toLocaleDateString('tr-TR')
                            : 'Süresiz'}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Tag>SMS lisansı yok</Tag>
                    )}
                    <Typography.Paragraph strong style={{ marginTop: 16, marginBottom: 8 }}>
                      Yapay zekâ eklentisi
                    </Typography.Paragraph>
                    {activeAiLicense ? (
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Plan">{activeAiLicense.plan}</Descriptions.Item>
                        <Descriptions.Item label="Günlük sınır">
                          {activeAiLicense.ai_effective_limit === 0
                            ? 'Sınırsız'
                            : `${activeAiLicense.ai_used_today ?? 0} / ${activeAiLicense.ai_effective_limit ?? '—'} (bugün)`}
                          {activeAiLicense.ai_daily_limit == null && ' · varsayılan'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Bitiş">
                          {activeAiLicense.ends_at
                            ? new Date(activeAiLicense.ends_at).toLocaleDateString('tr-TR')
                            : 'Süresiz'}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Tag>Yapay zekâ lisansı yok</Tag>
                    )}
                  </Card>
                ),
              },
              {
                id: 'tenant-schools',
                span: { xs: 24 },
                node: (
                  <Card title="Okullar" loading={loading}>
                    <SortableTable
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={schools}
                      scroll={{ x: 'max-content' }}
                      columns={[
                        { title: 'Ad', dataIndex: 'name' },
                        { title: 'Kod', dataIndex: 'code' },
                        {
                          title: 'İşlem',
                          key: 'actions',
                          render: (_: unknown, record: TenantSchool) => (
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => openEditSchool(record)}
                            >
                              Okul adını düzenle
                            </Button>
                          ),
                        },
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
                    <SortableTable
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={users}
                      scroll={{ x: 'max-content' }}
                      columns={[
                        { title: 'Ad soyad', dataIndex: 'full_name' },
                        { title: 'E-posta', dataIndex: 'email' },
                        {
                          title: 'Telefon',
                          dataIndex: 'phone',
                          render: (phone: string | null | undefined) => phone || '—',
                        },
                        {
                          title: 'SMS istek',
                          key: 'sms_req',
                          render: (_: unknown, record: TenantUser) =>
                            `${record.sms_login_requests_count ?? 0}/3`,
                        },
                        { title: 'Rol', dataIndex: 'role' },
                        {
                          title: 'Son giriş',
                          dataIndex: 'last_login_at',
                          render: (value: string | null) =>
                            value ? new Date(value).toLocaleString('tr-TR') : '—',
                        },
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
                          title: 'Giriş kilidi',
                          key: 'login_lock',
                          render: (_: unknown, record: TenantUser) => {
                            if (isLoginLocked(record)) {
                              return (
                                <Tag color="red">
                                  {new Date(record.login_locked_until as string).toLocaleString(
                                    'tr-TR',
                                  )}
                                  ’e kadar kilitli
                                </Tag>
                              )
                            }
                            const failed = Number(record.login_failed_count || 0)
                            return failed > 0 ? (
                              <Tag color="orange">{failed} hatalı deneme</Tag>
                            ) : (
                              <Tag color="green">Açık</Tag>
                            )
                          },
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
                              <Button size="small" onClick={() => openResetPassword(record)}>
                                Şifre sıfırla
                              </Button>
                              <Popconfirm
                                title={`${record.full_name} için giriş kilidi kaldırılsın mı?`}
                                description="Hatalı şifre sayacı sıfırlanır, kullanıcı hemen giriş yapabilir."
                                okText="Kaldır"
                                cancelText="Vazgeç"
                                disabled={!hasLoginLock(record)}
                                onConfirm={() => void handleUnlockUserLogin(record.id)}
                              >
                                <Button
                                  size="small"
                                  icon={<UnlockOutlined />}
                                  disabled={!hasLoginLock(record)}
                                  loading={unlockingUserId === record.id}
                                >
                                  Kilidi kaldır
                                </Button>
                              </Popconfirm>
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
                              <Popconfirm
                                title={`${record.full_name} için SMS istek sayacı sıfırlansın mı?`}
                                description="Günlük SMS hakkı ve giriş kilidi temizlenir."
                                okText="Sıfırla"
                                cancelText="Vazgeç"
                                onConfirm={() => void handleResetUserSms(record.id)}
                              >
                                <Button
                                  size="small"
                                  loading={resettingSmsUserId === record.id}
                                >
                                  SMS sayacı sıfırla
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
        title="Okul adını düzenle"
        open={Boolean(editingSchool)}
        onCancel={closeEditSchool}
        onOk={() => schoolNameForm.submit()}
        confirmLoading={savingSchoolName}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnClose
      >
        <Form
          form={schoolNameForm}
          layout="vertical"
          onFinish={(values) => void handleSaveSchoolName(values)}
        >
          <Form.Item
            name="name"
            label="Okul adı"
            extra={
              editingSchool && tenant?.name === editingSchool.name
                ? 'Hesap adı da bu adla aynı; kayıtta o da güncellenir.'
                : undefined
            }
            rules={[
              {
                validator: (_, value) => {
                  const name = String(value || '').trim()
                  if (!name) return Promise.reject(new Error('Okul adı zorunludur'))
                  if (name.length < 2) return Promise.reject(new Error('En az 2 karakter'))
                  if (name.length > 200) return Promise.reject(new Error('En fazla 200 karakter'))
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>

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
          <Form.Item
            name="phone"
            label="Kullanıcı telefonu (SMS)"
            extra={
              tenant?.sms_login_enabled
                ? 'SMS ile giriş açık: bu kullanıcının cep telefonu zorunludur.'
                : 'SMS bildirimleri ve SMS giriş kodu bu numaraya gider (kurum telefonundan ayrıdır).'
            }
            rules={[
              ...(tenant?.sms_login_enabled
                ? [{ required: true, message: 'Telefon zorunludur' }]
                : []),
              requiredMobilePhoneRule(Boolean(tenant?.sms_login_enabled)),
            ]}
          >
            <Input placeholder="05xx xxx xx xx" maxLength={30} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={passwordUser ? `${passwordUser.full_name} — şifre sıfırla` : 'Şifre sıfırla'}
        open={Boolean(passwordUser)}
        onCancel={closeResetPassword}
        onOk={() => passwordForm.submit()}
        confirmLoading={savingPassword}
        okText="Şifreyi kaydet"
        cancelText="Vazgeç"
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          Yeni şifre en az 8 karakter olmalıdır. Kayıt sonrası giriş kilidi de kalkar.
        </Typography.Paragraph>
        <Form form={passwordForm} layout="vertical" onFinish={(values) => void handleResetPassword(values)}>
          <Form.Item
            name="password"
            label="Yeni şifre"
            rules={[
              { required: true, message: 'Yeni şifre zorunludur' },
              { min: 8, message: 'Şifre en az 8 karakter olmalı' },
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="En az 8 karakter" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Yeni şifre (tekrar)"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Şifre tekrarı zorunludur' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Şifreler eşleşmiyor'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
