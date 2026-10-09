import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  MailOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { AppLayout } from '../../components/AppLayout'
import { warnAttention } from '../../utils/attention'
import { getErrorMessage } from '../../api/client'
import {
  deleteMailboxMessage,
  downloadMailboxAttachment,
  getMailboxMessage,
  getMailboxStatus,
  listMailboxMessages,
  sendMailboxMessage,
  type MailboxFolder,
  type MailboxMessage,
  type MailboxMessageSummary,
  type MailboxStatus,
} from '../../api/mailbox'

interface ComposeValues {
  to: string
  cc?: string
  subject: string
  text: string
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
}

function quoteBody(msg: MailboxMessage) {
  const lines = (msg.text || '').split(/\r?\n/).map((line) => `> ${line}`)
  return `\n\n${msg.from} yazdı:\n${lines.join('\n')}`
}

export function MailboxPage() {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<MailboxStatus | null>(null)
  const [folder, setFolder] = useState('INBOX')
  const [items, setItems] = useState<MailboxMessageSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MailboxMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [form] = Form.useForm<ComposeValues>()

  const folders = status?.folders || []
  const currentFolder = folders.find((f) => f.path === folder)

  const loadStatus = useCallback(async () => {
    const next = await getMailboxStatus()
    setStatus(next)
    if (next.folders.length && !next.folders.some((f) => f.path === folder)) {
      const inbox = next.folders.find((f) => f.role === 'inbox') || next.folders[0]
      if (inbox) setFolder(inbox.path)
    }
    return next
  }, [folder])

  const loadList = useCallback(
    async (nextFolder = folder, nextPage = page) => {
      const data = await listMailboxMessages({ folder: nextFolder, page: nextPage, limit: 30 })
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    },
    [folder, page],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await loadStatus()
      if (!next.configured) {
        setItems([])
        setTotal(0)
        return
      }
      await loadList()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [loadList, loadStatus, message])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      setLoading(true)
      try {
        const next = await getMailboxStatus()
        if (cancelled) return
        setStatus(next)
        const startFolder =
          next.folders.find((f) => f.role === 'inbox')?.path || next.folders[0]?.path || 'INBOX'
        setFolder(startFolder)
        if (next.configured) {
          const data = await listMailboxMessages({ folder: startFolder, page: 1, limit: 30 })
          if (cancelled) return
          setItems(data.items)
          setTotal(data.total)
          setPage(data.page)
        }
      } catch (err) {
        if (!cancelled) message.error(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [message])

  const openFolder = async (next: MailboxFolder) => {
    setFolder(next.path)
    setSelected(null)
    setPage(1)
    setLoading(true)
    try {
      const data = await listMailboxMessages({ folder: next.path, page: 1, limit: 30 })
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
      await loadStatus()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const openMessage = async (row: MailboxMessageSummary) => {
    setDetailLoading(true)
    try {
      const data = await getMailboxMessage(row.uid, folder)
      setSelected(data)
      setItems((prev) => prev.map((item) => (item.uid === row.uid ? { ...item, seen: true } : item)))
      void loadStatus()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  const openCompose = (preset?: Partial<ComposeValues>) => {
    form.setFieldsValue({
      to: preset?.to || '',
      cc: preset?.cc || '',
      subject: preset?.subject || '',
      text: preset?.text || '',
    })
    setComposeOpen(true)
  }

  const onSend = async () => {
    try {
      const values = await form.validateFields()
      const to = values.to.trim()
      const subject = values.subject.trim()
      const text = values.text.trim()
      if (!to) {
        warnAttention(message, 'Alıcı adresini yazın', 'mailbox-to')
        return
      }
      if (!subject) {
        warnAttention(message, 'Konu yazın', 'mailbox-subject')
        return
      }
      if (!text) {
        warnAttention(message, 'İleti metnini yazın', 'mailbox-text')
        return
      }
      setSending(true)
      await sendMailboxMessage({ to, cc: values.cc?.trim() || undefined, subject, text })
      message.success('İleti gönderildi')
      setComposeOpen(false)
      form.resetFields()
      const sent = folders.find((f) => f.role === 'sent')
      if (sent) await openFolder(sent)
      else void reload()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const removeSelected = () => {
    if (!selected) return
    modal.confirm({
      title: 'İletiyi sil',
      content: currentFolder?.role === 'trash' ? 'İleti kalıcı olarak silinecek.' : 'İleti çöp kutusuna taşınacak.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteMailboxMessage(selected.uid, folder)
          message.success('İleti silindi')
          setSelected(null)
          await loadList(folder, page)
          await loadStatus()
        } catch (err) {
          message.error(getErrorMessage(err))
          throw err
        }
      },
    })
  }

  const folderExtra = useMemo(() => {
    if (!currentFolder) return null
    return `${currentFolder.unseen} okunmamış / ${currentFolder.messages} ileti`
  }, [currentFolder])

  return (
    <AppLayout title="Posta">
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Posta
          </Typography.Title>
          <Typography.Text type="secondary">
            {status?.address || 'info@oids.com.tr'} kutusunu buradan okuyup yanıtlayın.
            {folderExtra ? ` ${folderExtra}.` : ''}
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading}>
            Yenile
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openCompose()}
            disabled={status?.configured === false}
          >
            Yeni ileti
          </Button>
        </Space>
      </Space>

      {status && !status.configured && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Posta sunucusu henüz bağlanmadı"
          description="MAIL_ACCOUNT_PASSWORD ve IMAP/SMTP ayarlarını .env içine yazıp mail container'ını ayağa kaldırın."
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, 200px) minmax(280px, 1fr) minmax(320px, 1.3fr)',
          gap: 12,
          minHeight: 520,
          overflowX: 'auto',
        }}
      >
        <div style={{ border: '1px solid var(--ant-color-border, #f0f0f0)', borderRadius: 8, padding: 8 }}>
          <List
            size="small"
            dataSource={folders}
            locale={{ emptyText: 'Klasör yok' }}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: item.path === folder ? 'rgba(22, 119, 255, 0.08)' : undefined,
                  borderRadius: 6,
                  paddingInline: 8,
                }}
                onClick={() => void openFolder(item)}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>{item.label}</span>
                  {item.unseen > 0 ? <Tag color="blue">{item.unseen}</Tag> : <Typography.Text type="secondary">{item.messages}</Typography.Text>}
                </Space>
              </List.Item>
            )}
          />
        </div>

        <div style={{ border: '1px solid var(--ant-color-border, #f0f0f0)', borderRadius: 8, overflow: 'hidden' }}>
          <Spin spinning={loading}>
            <List
              dataSource={items}
              locale={{ emptyText: <Empty description="Bu klasörde ileti yok" /> }}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: selected?.uid === item.uid ? 'rgba(22, 119, 255, 0.08)' : undefined,
                    paddingInline: 12,
                  }}
                  onClick={() => void openMessage(item)}
                >
                  <div style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text strong={!item.seen}>{item.from || '—'}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatWhen(item.date)}
                      </Typography.Text>
                    </Space>
                    <div>
                      <Typography.Text strong={!item.seen}>{item.subject}</Typography.Text>
                      {item.has_attachment ? (
                        <PaperClipOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                      ) : null}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Spin>
          {total > 30 && (
            <div style={{ padding: 8, textAlign: 'center' }}>
              <Button
                size="small"
                disabled={page <= 1}
                onClick={() => {
                  const next = page - 1
                  setPage(next)
                  void loadList(folder, next)
                }}
              >
                Önceki
              </Button>
              <Typography.Text type="secondary" style={{ margin: '0 8px' }}>
                {page}
              </Typography.Text>
              <Button
                size="small"
                disabled={page * 30 >= total}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  void loadList(folder, next)
                }}
              >
                Sonraki
              </Button>
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--ant-color-border, #f0f0f0)', borderRadius: 8, padding: 16, minHeight: 520 }}>
          <Spin spinning={detailLoading}>
            {!selected ? (
              <Empty image={<MailOutlined style={{ fontSize: 36 }} />} description="Bir ileti seçin" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {selected.subject}
                </Typography.Title>
                <div>
                  <div>
                    <Typography.Text type="secondary">Kimden: </Typography.Text>
                    {selected.from}
                  </div>
                  <div>
                    <Typography.Text type="secondary">Kime: </Typography.Text>
                    {selected.to || '—'}
                  </div>
                  {selected.cc ? (
                    <div>
                      <Typography.Text type="secondary">Bilgi: </Typography.Text>
                      {selected.cc}
                    </div>
                  ) : null}
                  <Typography.Text type="secondary">{formatWhen(selected.date)}</Typography.Text>
                </div>
                <Space>
                  <Button
                    icon={<SendOutlined />}
                    onClick={() =>
                      openCompose({
                        to: selected.from_email || selected.from,
                        subject: selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`,
                        text: quoteBody(selected),
                      })
                    }
                  >
                    Yanıtla
                  </Button>
                  <Button danger icon={<DeleteOutlined />} onClick={removeSelected}>
                    Sil
                  </Button>
                </Space>
                {selected.attachments.length > 0 && (
                  <Space wrap>
                    {selected.attachments.map((att) => (
                      <Button
                        key={att.index}
                        size="small"
                        icon={<PaperClipOutlined />}
                        onClick={() =>
                          downloadMailboxAttachment(selected.uid, selected.folder, att.index, att.filename).catch(
                            (err) => message.error(getErrorMessage(err)),
                          )
                        }
                      >
                        {att.filename}
                      </Button>
                    ))}
                  </Space>
                )}
                {selected.html ? (
                  <iframe
                    title="İleti"
                    sandbox=""
                    srcDoc={selected.html}
                    style={{ width: '100%', minHeight: 280, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff' }}
                  />
                ) : (
                  <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                    {selected.text || '(metin yok)'}
                  </Typography.Paragraph>
                )}
              </Space>
            )}
          </Spin>
        </div>
      </div>

      <Modal
        title="Yeni ileti"
        open={composeOpen}
        onCancel={() => setComposeOpen(false)}
        onOk={() => void onSend()}
        okText="Gönder"
        confirmLoading={sending}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <div data-attention="mailbox-to">
            <Form.Item name="to" label="Kime" rules={[{ required: true, message: 'Alıcı gerekli' }]}>
              <Input placeholder="alici@ornek.com" />
            </Form.Item>
          </div>
          <Form.Item name="cc" label="Bilgi">
            <Input placeholder="isteğe bağlı, virgülle birden fazla" />
          </Form.Item>
          <div data-attention="mailbox-subject">
            <Form.Item name="subject" label="Konu" rules={[{ required: true, message: 'Konu gerekli' }]}>
              <Input />
            </Form.Item>
          </div>
          <div data-attention="mailbox-text">
            <Form.Item name="text" label="Metin" rules={[{ required: true, message: 'Metin gerekli' }]}>
              <Input.TextArea rows={10} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </AppLayout>
  )
}
