import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
  Button,
} from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { AppLayout } from '../components/AppLayout'
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

interface ProfileForm {
  full_name: string
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
      const payload = await updateProfile(values.full_name.trim())
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
      const result = await updateTenantTwoFactorSetting(checked)
      setTenantTwoFactorEnabled(result.two_factor_enabled)
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
      <div style={{ maxWidth: 880 }}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Profilim
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Hesap bilgilerinizi görüntüleyin, adınızı güncelleyin veya şifrenizi değiştirin.
        </Typography.Paragraph>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Hesap özeti">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Ad soyad">{user?.full_name}</Descriptions.Item>
                <Descriptions.Item label="E-posta">{user?.email}</Descriptions.Item>
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
          </Col>

          <Col xs={24} md={12}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
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

              <Card title="Ad soyad güncelle">
                <Form
                  form={profileForm}
                  layout="vertical"
                  initialValues={{ full_name: user?.full_name }}
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
                  <Button type="primary" htmlType="submit" loading={profileSubmitting}>
                    Kaydet
                  </Button>
                </Form>
              </Card>

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

              {canManageTenant2fa ? (
                <Card title="Hesap güvenliği (yönetici)">
                  <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                    Açıldığında kullanıcılar profilinden iki adımlı doğrulama kurabilir. Kapatılırsa
                    tüm kullanıcıların 2FA ayarları sıfırlanır.
                  </Typography.Paragraph>
                  <Space>
                    <Switch
                      checked={tenantTwoFactorEnabled}
                      loading={tenant2faSaving}
                      onChange={(checked) => void onToggleTenant2fa(checked)}
                    />
                    <span>{tenantTwoFactorEnabled ? '2FA hesapta açık' : '2FA hesapta kapalı'}</span>
                  </Space>
                </Card>
              ) : null}

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
            </Space>
          </Col>
        </Row>
      </div>
    </AppLayout>
  )
}
