import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Card,
  Descriptions,
  Form,
  Input,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
  Button,
} from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { AppLayout } from '../components/AppLayout'
import { SortableDashboard } from '../components/SortableDashboard'
import { useAuth } from '../auth/AuthContext'
import { useThemeMode } from '../theme/ThemeContext'
import {
  changePassword,
  confirm2fa,
  disable2fa,
  get2faStatus,
  setup2fa,
  updateProfile,
  updateTenantTwoFactorSetting,
} from '../api/auth'
import { getErrorMessage } from '../api/client'
import type { TwoFactorSetup } from '../types/auth'
import { requiredMobilePhoneRule } from '../utils/phone'

interface ProfileForm {
  full_name: string
  phone?: string
}

interface PasswordForm {
  current_password: string
  new_password: string
  confirm_password: string
}

interface Confirm2faForm {
  code: string
}

interface Disable2faForm {
  password: string
  code: string
}

export function ProfilePage() {
  const { message } = App.useApp()
  const { session, setSessionPayload, refreshSession } = useAuth()
  const { mode, setMode } = useThemeMode()
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [tenant2faSaving, setTenant2faSaving] = useState(false)
  const [tenantTwoFactorEnabled, setTenantTwoFactorEnabled] = useState(
    Boolean(session?.tenant_two_factor_enabled),
  )
  const [tenantSmsLoginEnabled, setTenantSmsLoginEnabled] = useState(false)
  const [tenantSmsSaving, setTenantSmsSaving] = useState(false)
  const [userTotpEnabled, setUserTotpEnabled] = useState(Boolean(session?.user.totp_enabled))
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [profileForm] = Form.useForm<ProfileForm>()
  const [passwordForm] = Form.useForm<PasswordForm>()
  const [confirm2faForm] = Form.useForm<Confirm2faForm>()
  const [disable2faForm] = Form.useForm<Disable2faForm>()

  const user = session?.user
  const canManageTenant2fa = Boolean(session?.is_global_admin && !session?.is_platform_admin)

  useEffect(() => {
    let cancelled = false
    get2faStatus()
      .then((status) => {
        if (cancelled) return
        setTenantTwoFactorEnabled(status.tenant_two_factor_enabled)
        setTenantSmsLoginEnabled(Boolean(status.tenant_sms_login_enabled))
        setUserTotpEnabled(status.totp_enabled)
      })
      .catch(() => {
        // Profil yüklenirken 2FA durumu alınamazsa mevcut session değeri kullanılır.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onSaveProfile = async (values: ProfileForm) => {
    setProfileSubmitting(true)
    try {
      const payload = await updateProfile({
        full_name: values.full_name.trim(),
        phone: values.phone?.trim() || null,
      })
      setSessionPayload(payload)
      message.success('Profil güncellendi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setProfileSubmitting(false)
    }
  }

  const onChangePassword = async (values: PasswordForm) => {
    setPasswordSubmitting(true)
    try {
      await changePassword(values.current_password, values.new_password)
      passwordForm.resetFields()
      message.success('Şifreniz güncellendi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const onToggleTenant2fa = async (checked: boolean) => {
    setTenant2faSaving(true)
    try {
      const result = await updateTenantTwoFactorSetting({ two_factor_enabled: checked })
      setTenantTwoFactorEnabled(result.two_factor_enabled)
      setTenantSmsLoginEnabled(Boolean(result.sms_login_enabled))
      if (!result.two_factor_enabled) {
        setUserTotpEnabled(false)
        setSetupData(null)
        setBackupCodes(null)
      }
      await refreshSession()
      message.success(
        result.two_factor_enabled
          ? 'Hesap için iki adımlı doğrulama açıldı'
          : 'Hesap için iki adımlı doğrulama kapatıldı',
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTenant2faSaving(false)
    }
  }

  const onToggleTenantSmsLogin = async (checked: boolean) => {
    setTenantSmsSaving(true)
    try {
      const result = await updateTenantTwoFactorSetting({ sms_login_enabled: checked })
      setTenantSmsLoginEnabled(Boolean(result.sms_login_enabled))
      setTenantTwoFactorEnabled(result.two_factor_enabled)
      await refreshSession()
      message.success(
        result.sms_login_enabled
          ? 'SMS ile giriş hesap için açıldı'
          : 'SMS ile giriş hesap için kapatıldı',
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTenantSmsSaving(false)
    }
  }

  const onStart2faSetup = async () => {
    setTwoFactorLoading(true)
    try {
      const data = await setup2fa()
      setSetupData(data)
      setBackupCodes(null)
      confirm2faForm.resetFields()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const onConfirm2fa = async (values: Confirm2faForm) => {
    setTwoFactorLoading(true)
    try {
      const result = await confirm2fa(values.code.trim())
      setUserTotpEnabled(true)
      setSetupData(null)
      setBackupCodes(result.backup_codes)
      confirm2faForm.resetFields()
      await refreshSession()
      message.success('İki adımlı doğrulama etkinleştirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const onDisable2fa = async (values: Disable2faForm) => {
    setTwoFactorLoading(true)
    try {
      await disable2fa(values.password, values.code.trim())
      setUserTotpEnabled(false)
      setSetupData(null)
      setBackupCodes(null)
      disable2faForm.resetFields()
      await refreshSession()
      message.success('İki adımlı doğrulama kapatıldı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  return (
    <AppLayout title="Profilim">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Profilim
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Hesap bilgilerinizi görüntüleyin, adınızı ve telefonunuzu güncelleyin veya şifrenizi değiştirin.
          Kartları sürükleyerek yan yana hizalayabilir (2–6), alta bırakarak tam genişlik yapabilirsiniz.
        </Typography.Paragraph>

        <SortableDashboard
          layoutKey={`profile:${session?.user.id ?? 0}`}
          widgets={[
            {
              id: 'profile-summary',
              span: { xs: 24, md: 12 },
              node: (
                <Card title="Hesap özeti">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Ad soyad">{user?.full_name}</Descriptions.Item>
                    <Descriptions.Item label="E-posta">{user?.email}</Descriptions.Item>
                    <Descriptions.Item label="Telefon">{user?.phone || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Global rol">{user?.role}</Descriptions.Item>
                    <Descriptions.Item label="Okul rolleri">
                      <Space wrap>
                        {(session?.roles || []).length === 0
                          ? '—'
                          : session!.roles.map((role) => (
                              <Tag key={role} color="blue">
                                {role}
                              </Tag>
                            ))}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Bağlı okullar">
                      {(session?.schools || [])
                        .map((school) => `${school.name}${school.role ? ` (${school.role})` : ''}`)
                        .join(', ') || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Lisans">
                      {session?.license?.plan || (session?.license_status === 'exempt' ? 'Muaf' : '—')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Lisans bitiş tarihi">
                      {session?.license_status === 'exempt'
                        ? '—'
                        : session?.license?.ends_at
                          ? new Date(session.license.ends_at).toLocaleDateString('tr-TR')
                          : session?.license
                            ? 'Süresiz'
                            : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Son giriş">
                      {user?.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('tr-TR')
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="2FA">
                      {userTotpEnabled ? <Tag color="green">Açık</Tag> : <Tag>Kapalı</Tag>}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
            {
              id: 'profile-appearance',
              span: { xs: 24, md: 12 },
              node: (
                <Card title="Görünüm">
                  <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                    Arayüz temasını açık veya koyu moda alın. Tercih bu cihazda saklanır.
                  </Typography.Paragraph>
                  <Segmented
                    value={mode}
                    onChange={(value) => setMode(value as 'light' | 'dark')}
                    options={[
                      { label: 'Açık', value: 'light', icon: <SunOutlined /> },
                      { label: 'Koyu', value: 'dark', icon: <MoonOutlined /> },
                    ]}
                  />
                </Card>
              ),
            },
            {
              id: 'profile-name',
              span: { xs: 24, md: 12 },
              node: (
                <Card title="Profil bilgileri">
                  <Form
                    form={profileForm}
                    layout="vertical"
                    initialValues={{ full_name: user?.full_name, phone: user?.phone || undefined }}
                    onFinish={onSaveProfile}
                  >
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
                      name="phone"
                      label="Kullanıcı telefonu (SMS)"
                      extra={
                        tenantSmsLoginEnabled
                          ? 'SMS ile giriş açık: geçerli cep telefonu zorunludur (05xxxxxxxxx).'
                          : 'İş takibi ve diğer SMS bildirimleri bu numaraya gönderilir.'
                      }
                      rules={[
                        ...(tenantSmsLoginEnabled
                          ? [{ required: true, message: 'Telefon zorunludur' }]
                          : []),
                        requiredMobilePhoneRule(tenantSmsLoginEnabled),
                      ]}
                    >
                      <Input placeholder="05xx xxx xx xx" maxLength={30} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={profileSubmitting}>
                      Kaydet
                    </Button>
                  </Form>
                </Card>
              ),
            },
            {
              id: 'profile-password',
              span: { xs: 24, md: 12 },
              node: (
                <Card title="Şifre değiştir">
                  <Form form={passwordForm} layout="vertical" onFinish={onChangePassword}>
                    <Form.Item
                      name="current_password"
                      label="Mevcut şifre"
                      rules={[{ required: true, message: 'Mevcut şifre zorunludur' }]}
                    >
                      <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item
                      name="new_password"
                      label="Yeni şifre"
                      rules={[
                        { required: true, message: 'Yeni şifre zorunludur' },
                        { min: 8, message: 'En az 8 karakter' },
                      ]}
                    >
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item
                      name="confirm_password"
                      label="Yeni şifre (tekrar)"
                      dependencies={['new_password']}
                      rules={[
                        { required: true, message: 'Şifre tekrarı zorunludur' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('new_password') === value) {
                              return Promise.resolve()
                            }
                            return Promise.reject(new Error('Şifreler eşleşmiyor'))
                          },
                        }),
                      ]}
                    >
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={passwordSubmitting}>
                      Şifreyi güncelle
                    </Button>
                  </Form>
                </Card>
              ),
            },
            ...(canManageTenant2fa
              ? [
                  {
                    id: 'profile-tenant-2fa',
                    span: { xs: 24, md: 12 },
                    node: (
                      <Card title="Hesap güvenliği (yönetici)">
                        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                          Authenticator (2FA) veya SMS ile giriş ikinci doğrulama yöntemleridir. SMS
                          için her kullanıcının kendi telefonu gerekir; kurum telefonu kayıtlıysa
                          telefonu boş kullanıcılara otomatik aktarılır. Günde en fazla 3 SMS kodu
                          isteği yapılabilir.
                        </Typography.Paragraph>
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Space>
                            <Switch
                              checked={tenantTwoFactorEnabled}
                              loading={tenant2faSaving}
                              onChange={(checked) => void onToggleTenant2fa(checked)}
                            />
                            <span>
                              {tenantTwoFactorEnabled
                                ? 'Authenticator 2FA açık'
                                : 'Authenticator 2FA kapalı'}
                            </span>
                          </Space>
                          <Space>
                            <Switch
                              checked={tenantSmsLoginEnabled}
                              loading={tenantSmsSaving}
                              onChange={(checked) => void onToggleTenantSmsLogin(checked)}
                            />
                            <span>
                              {tenantSmsLoginEnabled ? 'SMS ile giriş açık' : 'SMS ile giriş kapalı'}
                            </span>
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Açmak için tüm aktif kullanıcıların geçerli cep telefonu (05xxxxxxxxx)
                            tanımlı olmalıdır.
                          </Typography.Text>
                        </Space>
                      </Card>
                    ),
                  },
                ]
              : []),
            {
              id: 'profile-2fa',
              span: { xs: 24, md: 12 },
              node: (
                <Card title="İki adımlı doğrulama (2FA)">
                  {!tenantTwoFactorEnabled ? (
                    <Alert
                      type="info"
                      showIcon
                      message="Hesabınızda 2FA henüz açılmamış. Yönetici Profilim üzerinden açabilir."
                    />
                  ) : userTotpEnabled ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Alert type="success" showIcon message="Authenticator ile 2FA aktif." />
                      {backupCodes ? (
                        <Alert
                          type="warning"
                          showIcon
                          message="Yedek kodları güvenli bir yere kaydedin (bir kez gösterilir)."
                          description={
                            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                              {backupCodes.map((code) => (
                                <li key={code}>
                                  <code>{code}</code>
                                </li>
                              ))}
                            </ul>
                          }
                        />
                      ) : null}
                      <Form form={disable2faForm} layout="vertical" onFinish={onDisable2fa}>
                        <Form.Item
                          name="password"
                          label="Şifre"
                          rules={[{ required: true, message: 'Şifre zorunludur' }]}
                        >
                          <Input.Password autoComplete="current-password" />
                        </Form.Item>
                        <Form.Item
                          name="code"
                          label="Doğrulama kodu"
                          rules={[{ required: true, message: 'Kod zorunludur' }]}
                        >
                          <Input placeholder="6 haneli kod veya yedek kod" />
                        </Form.Item>
                        <Button danger htmlType="submit" loading={twoFactorLoading}>
                          2FA’yı kapat
                        </Button>
                      </Form>
                    </Space>
                  ) : (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                        Google Authenticator veya benzeri bir uygulama ile girişlerde ek kod isteyin.
                      </Typography.Paragraph>
                      {!setupData ? (
                        <Button type="primary" loading={twoFactorLoading} onClick={() => void onStart2faSetup()}>
                          2FA kurulumunu başlat
                        </Button>
                      ) : (
                        <>
                          <img
                            src={setupData.qr_data_url}
                            alt="2FA QR kodu"
                            width={180}
                            height={180}
                            style={{ borderRadius: 8 }}
                          />
                          <Typography.Text type="secondary">
                            Manuel anahtar: <code>{setupData.secret}</code>
                          </Typography.Text>
                          <Form form={confirm2faForm} layout="vertical" onFinish={onConfirm2fa}>
                            <Form.Item
                              name="code"
                              label="Uygulamadaki kod"
                              rules={[{ required: true, message: 'Kod zorunludur' }]}
                            >
                              <Input placeholder="6 haneli kod" autoComplete="one-time-code" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={twoFactorLoading}>
                              Doğrula ve etkinleştir
                            </Button>
                          </Form>
                        </>
                      )}
                    </Space>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>
    </AppLayout>
  )
}
