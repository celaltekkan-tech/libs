import { useState } from 'react'
import { App, Card, Col, Descriptions, Form, Input, Row, Space, Tag, Typography, Button } from 'antd'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { changePassword, updateProfile } from '../api/auth'
import { getErrorMessage } from '../api/client'

interface ProfileForm {
  full_name: string
}

interface PasswordForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export function ProfilePage() {
  const { message } = App.useApp()
  const { session, setSessionPayload } = useAuth()
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [profileForm] = Form.useForm<ProfileForm>()
  const [passwordForm] = Form.useForm<PasswordForm>()

  const user = session?.user

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
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
            </Space>
          </Col>
        </Row>
      </div>
    </AppLayout>
  )
}
