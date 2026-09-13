import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { useThemeMode } from '../theme/ThemeContext'
import { ApiError, getErrorMessage } from '../api/client'
import { isLoginChallenge2fa, type LoginFormValues, type SessionPayload } from '../types/auth'

interface TwoFactorForm {
  code: string
}

export function LoginPage() {
  const { login, complete2fa } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm<LoginFormValues>()
  const [twoFactorForm] = Form.useForm<TwoFactorForm>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempToken, setTempToken] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from || '/'

  function navigateAfterLogin(session: SessionPayload) {
    let target = from || '/'
    if (session.is_platform_admin) {
      target = from.startsWith('/platform') || from === '/' ? from : '/'
    } else if (from.startsWith('/platform')) {
      target = '/'
    }
    navigate(target, { replace: true })
  }

  async function onFinish(values: LoginFormValues) {
    setError(null)
    setSubmitting(true)
    try {
      const result = await login({
        email: values.email.trim(),
        password: values.password,
      })
      if (isLoginChallenge2fa(result)) {
        setTempToken(result.temp_token)
        twoFactorForm.resetFields()
        return
      }
      navigateAfterLogin(result)
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

  async function onVerify2fa(values: TwoFactorForm) {
    if (!tempToken) return
    setError(null)
    setSubmitting(true)
    try {
      const session = await complete2fa(tempToken, values.code.trim())
      navigateAfterLogin(session)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function backToCredentials() {
    setTempToken(null)
    setError(null)
    twoFactorForm.resetFields()
  }

  return (
    <div className="login-page">
      <Button
        className="login-theme-toggle"
        type="text"
        icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggleMode}
        title={mode === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
        aria-label={mode === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
      />
      <div className="login-panel">
        <div className="login-brand">
          <span className="login-mark">Lİ</span>
          <div>
            <Typography.Title level={3} className="login-title">
              Okul İdare Sistemi
            </Typography.Title>
            <Typography.Paragraph className="login-subtitle">
              {tempToken
                ? 'Authenticator uygulamanızdaki kodu girin'
                : 'Yönetici paneline giriş yapın'}
            </Typography.Paragraph>
          </div>
        </div>

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />
        ) : null}

        {tempToken ? (
          <Form
            form={twoFactorForm}
            layout="vertical"
            requiredMark={false}
            onFinish={onVerify2fa}
            autoComplete="one-time-code"
          >
            <Form.Item
              label="Doğrulama kodu"
              name="code"
              rules={[{ required: true, message: 'Doğrulama kodu zorunludur' }]}
            >
              <Input
                size="large"
                prefix={<SafetyCertificateOutlined />}
                placeholder="6 haneli kod veya yedek kod"
                autoFocus
                autoComplete="one-time-code"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              Doğrula ve giriş yap
            </Button>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={backToCredentials}
              style={{ marginTop: 8, paddingInline: 0 }}
            >
              Şifre adımına dön
            </Button>
          </Form>
        ) : (
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
        )}

        <p className="login-hint">Hesabınız yoksa okul yöneticinizle iletişime geçin.</p>
      </div>
    </div>
  )
}
