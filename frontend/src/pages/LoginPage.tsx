import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Checkbox, Form, Input, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  MoonOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { useThemeMode } from '../theme/ThemeContext'
import { ApiError, getErrorMessage } from '../api/client'
import { fetchCaptcha, resendSms } from '../api/auth'
import { readLastSchoolBrand } from '../utils/lastSchoolBrand'
import {
  armRememberedLoginWarning,
  readRememberedLogin,
  writeRememberedLogin,
} from '../utils/rememberedLogin'
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
  const remembered = useMemo(() => readRememberedLogin(), [])
  const [remember, setRemember] = useState(Boolean(remembered))
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const captchaEase = useRef(0)

  const from = (location.state as { from?: string } | null)?.from || '/'

  const loadCaptcha = async (ease: number) => {
    setCaptchaLoading(true)
    try {
      const next = await fetchCaptcha(ease)
      setCaptchaId(next.id)
      setCaptchaSvg(next.svg)
      form.setFieldValue('captcha_code', '')
    } catch (err) {
      setCaptchaId(null)
      setCaptchaSvg(null)
      setError(getErrorMessage(err))
    } finally {
      setCaptchaLoading(false)
    }
  }

  const refreshCaptcha = () => {
    captchaEase.current = Math.min(2, captchaEase.current + 1)
    return loadCaptcha(captchaEase.current)
  }

  useEffect(() => {
    if (remembered) {
      form.setFieldsValue({ email: remembered.email, password: remembered.password })
    }
    captchaEase.current = 0
    void loadCaptcha(0)
    // Yalnızca ilk açılışta kayıtlı bilgileri ve görseli yükle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function persistRememberChoice(email: string, password: string, accepted: boolean) {
    if (!remember) {
      writeRememberedLogin(null)
      return
    }
    if (accepted) writeRememberedLogin({ email, password })
  }

  async function onFinish(values: LoginFormValues) {
    setError(null)
    setInfo(null)
    if (!captchaId) {
      setError('Görsel doğrulama yüklenemedi. Yenileyip tekrar deneyin.')
      return
    }
    setSubmitting(true)
    try {
      const email = values.email.trim()
      const result = await login({
        email,
        password: values.password,
        captcha_id: captchaId,
        captcha_code: values.captcha_code.trim(),
      })
      persistRememberChoice(email, values.password, true)
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
      const usesSecondFactor =
        Boolean(result.user.totp_enabled) ||
        Boolean(result.tenant_sms_login_enabled && !result.is_platform_admin)
      armRememberedLoginWarning(!usesSecondFactor)
      navigateAfterLogin(result)
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setError(err.fields.map((field) => field.message).join(' '))
      } else {
        setError(getErrorMessage(err))
      }
      void loadCaptcha(captchaEase.current)
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
      armRememberedLoginWarning(false)
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

  const lastBrand = useMemo(() => readLastSchoolBrand(), [])

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
          {lastBrand ? (
            <span className="login-mark login-mark-image">
              <img src={lastBrand.dataUrl} alt={lastBrand.name} />
            </span>
          ) : (
            <span className="login-mark">Lİ</span>
          )}
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

            <div className="login-captcha-row">
              <div className="login-captcha-image">
                {captchaSvg ? (
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}`}
                    alt="Görsel doğrulama kodu"
                    draggable={false}
                  />
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {captchaLoading ? '…' : '—'}
                  </Typography.Text>
                )}
              </div>
              <Button
                type="text"
                icon={<ReloadOutlined />}
                loading={captchaLoading}
                onClick={() => void refreshCaptcha()}
                aria-label="Görsel doğrulama kodunu yenile"
                title="Görseli yenile"
                style={{ height: 40, width: 40 }}
              />
              <Form.Item
                className="login-captcha-field"
                name="captcha_code"
                rules={[{ required: true, message: 'Görsel doğrulama kodu zorunludur' }]}
              >
                <Input
                  size="large"
                  prefix={<SafetyCertificateOutlined />}
                  placeholder="Görseldeki kod"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={8}
                />
              </Form.Item>
            </div>

            <Form.Item style={{ marginBottom: 12 }}>
              <Checkbox
                checked={remember}
                onChange={(event) => {
                  const checked = event.target.checked
                  setRemember(checked)
                  if (!checked) writeRememberedLogin(null)
                }}
              >
                Kullanıcı adımı ve şifremi hatırla
              </Checkbox>
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
