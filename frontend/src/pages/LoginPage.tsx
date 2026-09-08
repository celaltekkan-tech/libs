import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { ApiError, getErrorMessage } from '../api/client'
import type { LoginFormValues } from '../types/auth'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm<LoginFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from || '/'

  async function onFinish(values: LoginFormValues) {
    setError(null)
    setSubmitting(true)
    try {
      await login({
        email: values.email.trim(),
        password: values.password,
      })
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setError(err.fields.map((field) => field.message).join(' '))
      } else {
        setError(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <span className="login-mark">Lİ</span>
          <div>
            <Typography.Title level={3} className="login-title">
              Okul İdare Sistemi
            </Typography.Title>
            <Typography.Paragraph className="login-subtitle">
              Yönetici paneline giriş yapın
            </Typography.Paragraph>
          </div>
        </div>

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          autoComplete="on"
        >
          <Form.Item
            label="E-posta"
            name="email"
            rules={[
              { required: true, message: 'E-posta zorunludur' },
              {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Geçerli bir e-posta adresi girin',
              },
            ]}
          >
            <Input
              size="large"
              prefix={<MailOutlined />}
              placeholder="ornek@okul.local"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            label="Şifre"
            name="password"
            rules={[{ required: true, message: 'Şifre zorunludur' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="Şifreniz"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Giriş yap
          </Button>
        </Form>

        <p className="login-hint">
          Hesabınız yoksa okul yöneticinizle iletişime geçin. Demo hesap:
          <br />
          <strong>admin@okul.local</strong> / <strong>Admin1234</strong>
        </p>
      </div>
    </div>
  )
}
