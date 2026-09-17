import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { useThemeMode } from '../theme/ThemeContext'
import { ApiError, getErrorMessage } from '../api/client'
import { resendSms } from '../api/auth'
import {
  isLoginChallenge2fa,
  isLoginChallengeSms,
  type LoginChallengeSms,
  type LoginFormValues,
  type SessionPayload,
} from '../types/auth'

interface TwoFactorForm {
  code: string
}

type ChallengeMode = 'totp' | 'sms' | null

export function LoginPage() {
  const { login, complete2fa, completeSms } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm<LoginFormValues>()
  const [twoFactorForm] = Form.useForm<TwoFactorForm>()
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>(null)
  const [smsMeta, setSmsMeta] = useState<Pick<
    LoginChallengeSms,
    'phone_hint' | 'requests_remaining' | 'max_requests'
  > | null>(null)

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

  function applySmsChallenge(challenge: LoginChallengeSms) {
    setChallengeMode('sms')
    setTempToken(challenge.temp_token)
    setSmsMeta({
      phone_hint: challenge.phone_hint,
      requests_remaining: challenge.requests_remaining,
      max_requests: challenge.max_requests,
    })
    twoFactorForm.resetFields()
  }

  async function onFinish(values: LoginFormValues) {
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const result = await login({
        email: values.email.trim(),
        password: values.password,
      })
      if (isLoginChallenge2fa(result)) {
        setChallengeMode('totp')
        setTempToken(result.temp_token)
        setSmsMeta(null)
        twoFactorForm.resetFields()
        return
      }
      if (isLoginChallengeSms(result)) {
        applySmsChallenge(result)
        setInfo(`Doğrulama kodu ${result.phone_hint} numarasına gönderildi.`)
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

  async function onVerifyChallenge(values: TwoFactorForm) {
    if (!tempToken || !challengeMode) return
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const session =
        challengeMode === 'sms'
          ? await completeSms(tempToken, values.code.trim())
          : await complete2fa(tempToken, values.code.trim())
      navigateAfterLogin(session)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onResendSms() {
    if (!tempToken || challengeMode !== 'sms') return
    setError(null)
    setInfo(null)
    setResending(true)
    try {
      const challenge = await resendSms(tempToken)
      applySmsChallenge(challenge)
      setInfo(
        `Yeni kod ${challenge.phone_hint} numarasına gönderildi. Kalan hak: ${challenge.requests_remaining}/${challenge.max_requests}`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  function backToCredentials() {
    setTempToken(null)
    setChallengeMode(null)
    setSmsMeta(null)
    setError(null)
    setInfo(null)
    twoFactorForm.resetFields()
  }

  const subtitle = !tempToken
    ? 'Yönetici paneline giriş yapın'
    : challengeMode === 'sms'
      ? 'Telefonunuza gelen SMS kodunu girin'
      : 'Authenticator uygulamanızdaki kodu girin'

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
            <Typography.Paragraph className="login-subtitle">{subtitle}</Typography.Paragraph>
          </div>
        </div>

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />
        ) : null}
        {info ? (
          <Alert type="info" showIcon message={info} style={{ marginBottom: 20 }} />
        ) : null}

        {tempToken ? (
          <Form
            form={twoFactorForm}
            layout="vertical"
            requiredMark={false}
            onFinish={onVerifyChallenge}
            autoComplete="one-time-code"
          >
            <Form.Item
              label={challengeMode === 'sms' ? 'SMS kodu' : 'Doğrulama kodu'}
              name="code"
              rules={[{ required: true, message: 'Doğrulama kodu zorunludur' }]}
              extra={
                challengeMode === 'sms' && smsMeta
                  ? `Numara: ${smsMeta.phone_hint} · Günlük kalan SMS hakkı: ${smsMeta.requests_remaining}/${smsMeta.max_requests}`
                  : undefined
              }
            >
              <Input
                size="large"
                prefix={
                  challengeMode === 'sms' ? <MessageOutlined /> : <SafetyCertificateOutlined />
                }
                placeholder={
                  challengeMode === 'sms' ? '6 haneli SMS kodu' : '6 haneli kod veya yedek kod'
                }
                autoFocus
                autoComplete="one-time-code"
                maxLength={challengeMode === 'sms' ? 6 : 20}
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              Doğrula ve giriş yap
            </Button>
            {challengeMode === 'sms' && (
              <Button
                type="default"
                size="large"
                block
                loading={resending}
                disabled={(smsMeta?.requests_remaining ?? 0) <= 0}
                onClick={() => void onResendSms()}
                style={{ marginTop: 8 }}
              >
                Yeni SMS kodu iste
              </Button>
            )}
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
