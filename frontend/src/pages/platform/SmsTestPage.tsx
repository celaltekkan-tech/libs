import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Form, Input, Space, Tag, Typography } from 'antd'
import { ReloadOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { SortableTable } from '../../components/SortableTable'
import { getSmsTestState, sendSmsTest, type SmsConfigSummary, type SmsTestEntry } from '../../api/smsTest'
import { getErrorMessage } from '../../api/client'
import { tablePagination } from '../../utils/tablePagination'

const PROVIDER_LABELS: Record<string, string> = {
  udp: 'UDP SMS motoru',
  http_api: 'HTTP API',
  external_cli: 'Harici program',
}

const SETTING_LABELS: Record<string, string> = {
  host: 'Sunucu',
  port: 'Port',
  reply_timeout_ms: 'Yanıt bekleme (ms)',
  url: 'URL',
  method: 'Metot',
  api_key_set: 'API anahtarı',
  program_path: 'Program yolu',
}

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  basarili: { color: 'green', label: 'Başarılı' },
  basarisiz: { color: 'red', label: 'Başarısız' },
  iptal: { color: 'default', label: 'İptal' },
  beklemede: { color: 'blue', label: 'Beklemede' },
}

const DEFAULT_MESSAGE = 'OIDS SMS test mesajı - Türkçe karakter: ğüşıöç ĞÜŞİÖÇ'

function formatSetting(key: string, value: string | number | boolean | null) {
  if (value === null || value === '') return <Typography.Text type="danger">tanımlı değil</Typography.Text>
  if (key === 'api_key_set') return value ? 'Tanımlı' : <Typography.Text type="danger">Yok</Typography.Text>
  if (key === 'reply_timeout_ms' && value === 0) return '0 (yanıt beklenmez)'
  return String(value)
}

interface FormValues {
  phone: string
  message: string
}

export function SmsTestPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [config, setConfig] = useState<SmsConfigSummary | null>(null)
  const [history, setHistory] = useState<SmsTestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [last, setLast] = useState<SmsTestEntry | null>(null)
  const messageValue: string = Form.useWatch('message', form) || ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSmsTestState()
      setConfig(data.config)
      setHistory(data.history)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onSend = async (values: FormValues) => {
    setSending(true)
    try {
      const entry = await sendSmsTest({ phone: values.phone.trim(), message: values.message.trim() })
      setLast(entry)
      setHistory((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)])
      if (entry.status === 'basarili') message.success('SMS motoruna iletildi')
      else message.error(entry.error || 'SMS gönderilemedi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const udpNoReply = config?.provider === 'udp' && !config.settings.reply_timeout_ms

  const columns: ColumnsType<SmsTestEntry> = [
    {
      title: 'Tarih',
      dataIndex: 'sent_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('tr-TR'),
    },
    { title: 'Telefon', dataIndex: 'phone', width: 150 },
    { title: 'Mesaj', dataIndex: 'message', ellipsis: true },
    {
      title: 'Durum',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Tag color={STATUS_TAGS[v]?.color}>{STATUS_TAGS[v]?.label || v}</Tag>,
    },
    { title: 'Hata', dataIndex: 'error', ellipsis: true, render: (v: string | null) => v || '—' },
    { title: 'Süre', dataIndex: 'duration_ms', width: 90, render: (v: number) => `${v} ms` },
    { title: 'Gönderen', dataIndex: 'sent_by', width: 160, render: (v: string | null) => v || '—' },
  ]

  return (
    <AppLayout title="SMS Test">
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            SMS Test
          </Typography.Title>
          <Typography.Text type="secondary">
            SMS motorunun yapılandırmasını görün ve test mesajı gönderin. Test gönderimleri lisans SMS kotasından düşmez.
          </Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          Yenile
        </Button>
      </Space>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="Aktif yapılandırma" loading={loading && !config} size="small">
          {config && (
            <>
              {!config.known && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`Bilinmeyen SMS_PROVIDER: ${config.provider}`}
                />
              )}
              <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
                <Descriptions.Item label="Sağlayıcı">
                  {PROVIDER_LABELS[config.provider] || config.provider}{' '}
                  <Typography.Text type="secondary">({config.provider})</Typography.Text>
                </Descriptions.Item>
                {Object.entries(config.settings).map(([key, value]) => (
                  <Descriptions.Item key={key} label={SETTING_LABELS[key] || key}>
                    {formatSetting(key, value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
              {udpNoReply && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="UDP gönder-unut modunda: “Başarılı” yalnızca paketin ağa çıktığını gösterir. Teslimi telefondan doğrulayın."
                />
              )}
            </>
          )}
        </Card>

        <Card title="Test mesajı gönder" size="small">
          <Form
            form={form}
            layout="vertical"
            onFinish={onSend}
            initialValues={{ message: DEFAULT_MESSAGE }}
            style={{ maxWidth: 560 }}
          >
            <Form.Item
              name="phone"
              label="Telefon"
              rules={[
                { required: true, message: 'Telefon zorunlu' },
                { pattern: /^[+\d\s()-]{10,20}$/, message: 'Geçerli bir telefon girin (örn. 05xx xxx xx xx)' },
              ]}
            >
              <Input placeholder="05xx xxx xx xx" inputMode="tel" />
            </Form.Item>
            <Form.Item
              name="message"
              label="Mesaj"
              extra={`${messageValue.length} karakter`}
              rules={[{ required: true, whitespace: true, message: 'Mesaj zorunlu' }]}
            >
              <Input.TextArea rows={3} maxLength={900} />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
              Gönder
            </Button>
          </Form>
          {last && (
            <Alert
              style={{ marginTop: 16, maxWidth: 560 }}
              showIcon
              type={last.status === 'basarili' ? 'success' : 'error'}
              message={`${STATUS_TAGS[last.status]?.label || last.status} — ${last.phone} (${last.duration_ms} ms)`}
              description={last.error || (last.provider_message_id ? `Mesaj kimliği: ${last.provider_message_id}` : undefined)}
            />
          )}
        </Card>

        <Card title="Son test gönderimleri" size="small">
          <SortableTable
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={history}
            pagination={tablePagination(10)}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Space>
    </AppLayout>
  )
}
