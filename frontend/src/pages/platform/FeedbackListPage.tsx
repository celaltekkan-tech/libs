import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  MessageOutlined,
  PaperClipOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { AppLayout } from '../../components/AppLayout'
import {
  deleteFeedback,
  downloadFeedbackAttachment,
  listFeedback,
  updateFeedback,
  viewFeedbackAttachment,
} from '../../api/feedback'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import {
  FEEDBACK_FILTER_OPTIONS,
  FEEDBACK_STATUS_LABEL,
  formatFileSize,
  isPdfAttachment,
  type Feedback,
  type FeedbackAttachment,
  type FeedbackStatus,
  type FeedbackStatusFilter,
} from '../../types/feedback'
import type { TenantListItem } from '../../types/tenant'

const { RangePicker } = DatePicker

export function FeedbackListPage() {
  const { message, modal } = App.useApp()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('all')
  const [tenantFilter, setTenantFilter] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null)
  const [replyForm] = Form.useForm<{ status: FeedbackStatus; reply: string }>()
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        setTenants(await listTenants())
      } catch (err) {
        message.error(getErrorMessage(err))
      }
    })()
  }, [message])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFeedbacks(
        await listFeedback({
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(tenantFilter != null ? { tenant_id: tenantFilter } : {}),
          ...(dateRange?.[0] ? { from: dateRange[0].format('YYYY-MM-DD') } : {}),
          ...(dateRange?.[1] ? { to: dateRange[1].format('YYYY-MM-DD') } : {}),
        }),
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, statusFilter, tenantFilter, dateRange])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (id: number, status: FeedbackStatus) => {
    try {
      await updateFeedback(id, { status })
      message.success('Durum güncellendi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const openReply = (record: Feedback) => {
    setReplyTarget(record)
    replyForm.setFieldsValue({
      status: record.status === 'new' || record.status === 'read' ? 'resolved' : record.status,
      reply: record.reply || '',
    })
  }

  const submitReply = async (values: { status: FeedbackStatus; reply: string }) => {
    if (!replyTarget) return
    setReplySubmitting(true)
    try {
      await updateFeedback(replyTarget.id, { status: values.status, reply: values.reply })
      message.success('Cevap gönderildi')
      setReplyTarget(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setReplySubmitting(false)
    }
  }

  const openAttachment = async (att: FeedbackAttachment, mode: 'view' | 'download') => {
    try {
      if (mode === 'view' && isPdfAttachment(att)) {
        await viewFeedbackAttachment(att.id, att.original_name, true)
      } else {
        await downloadFeedbackAttachment(att.id, att.original_name)
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const remove = (id: number) => {
    modal.confirm({
      title: 'Geri bildirimi sil',
      content: 'Bu geri bildirimi silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteFeedback(id)
          message.success('Geri bildirim silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  return (
    <AppLayout title="Geri Bildirimler">
      <div style={{ maxWidth: 960 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Geri Bildirimler
            </Typography.Title>
            <Typography.Text type="secondary">
              Tenant hesaplarından gelen mesajları filtreleyin, yanıtlayın ve ekleri inceleyin.
            </Typography.Text>
          </div>

          <Card size="small" styles={{ body: { padding: 12 } }}>
            <Space wrap style={{ width: '100%' }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Hesap (tenant)"
                style={{ minWidth: 220 }}
                value={tenantFilter}
                onChange={(value) => setTenantFilter(value)}
                options={tenants.map((t) => ({ value: t.id, label: t.name }))}
              />
              <Segmented
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as FeedbackStatusFilter)}
                options={FEEDBACK_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <RangePicker
                allowClear
                format="DD.MM.YYYY"
                value={dateRange}
                onChange={(values) => setDateRange(values as [Dayjs, Dayjs] | null)}
                placeholder={['Başlangıç', 'Bitiş']}
              />
            </Space>
          </Card>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <List
              dataSource={feedbacks}
              locale={{ emptyText: <Empty description="Bu filtrelere uygun geri bildirim yok" /> }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [5, 10, 20, 50],
                showTotal: (total) => `Toplam ${total} kayıt`,
                hideOnSinglePage: false,
              }}
              renderItem={(item) => {
                const statusMeta = FEEDBACK_STATUS_LABEL[item.status]
                return (
                  <List.Item key={item.id} style={{ padding: '8px 0', border: 'none' }}>
                    <Card style={{ width: '100%' }} styles={{ body: { padding: 16 } }}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
                          <Space direction="vertical" size={2}>
                            <Typography.Text strong style={{ fontSize: 15 }}>
                              {item.Tenant?.name || `Hesap #${item.tenant_id}`}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {item.User
                                ? `${item.User.full_name} · ${item.User.email}`
                                : 'Silinmiş kullanıcı'}
                              {' · '}
                              {new Date(item.created_at).toLocaleString('tr-TR')}
                            </Typography.Text>
                          </Space>
                          <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
                        </Space>

                        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                          {item.message}
                        </Typography.Paragraph>

                        {!!item.Attachments?.length && (
                          <Space wrap size={[8, 8]}>
                            {item.Attachments.map((att) => (
                              <Space
                                key={att.id}
                                size={4}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  background: '#f3f4f6',
                                }}
                              >
                                <PaperClipOutlined />
                                <Typography.Text>
                                  {att.original_name}
                                  <Typography.Text type="secondary">
                                    {' '}
                                    ({formatFileSize(att.size_bytes)})
                                  </Typography.Text>
                                </Typography.Text>
                                {isPdfAttachment(att) && (
                                  <Button
                                    size="small"
                                    type="link"
                                    icon={<EyeOutlined />}
                                    onClick={() => void openAttachment(att, 'view')}
                                  >
                                    Görüntüle
                                  </Button>
                                )}
                                <Button
                                  size="small"
                                  type="link"
                                  icon={<DownloadOutlined />}
                                  onClick={() => void openAttachment(att, 'download')}
                                >
                                  İndir
                                </Button>
                              </Space>
                            ))}
                          </Space>
                        )}

                        {item.reply && (
                          <Card size="small" type="inner" title="Verilen cevap">
                            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                              {item.reply}
                            </Typography.Paragraph>
                            {item.replied_at && (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {new Date(item.replied_at).toLocaleString('tr-TR')}
                              </Typography.Text>
                            )}
                          </Card>
                        )}

                        <Space wrap>
                          <Button type="primary" icon={<MessageOutlined />} onClick={() => openReply(item)}>
                            Yanıtla
                          </Button>
                          {item.status !== 'read' && item.status !== 'cancelled' && (
                            <Button icon={<EyeOutlined />} onClick={() => void changeStatus(item.id, 'read')}>
                              İnceleniyor
                            </Button>
                          )}
                          {item.status !== 'resolved' && (
                            <Button
                              icon={<CheckOutlined />}
                              onClick={() => void changeStatus(item.id, 'resolved')}
                            >
                              Sonuçlandı
                            </Button>
                          )}
                          {item.status !== 'cancelled' && (
                            <Button
                              icon={<CloseOutlined />}
                              onClick={() => void changeStatus(item.id, 'cancelled')}
                            >
                              İptal
                            </Button>
                          )}
                          <Button danger icon={<DeleteOutlined />} onClick={() => remove(item.id)}>
                            Sil
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  </List.Item>
                )
              }}
            />
          )}
        </Space>
      </div>

      <Modal
        title="Geri Bildirimi Yanıtla"
        open={!!replyTarget}
        onCancel={() => setReplyTarget(null)}
        onOk={() => replyForm.submit()}
        confirmLoading={replySubmitting}
        okText="Gönder"
        cancelText="Vazgeç"
        destroyOnHidden
        width={560}
      >
        {replyTarget && (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {replyTarget.Tenant?.name || `Hesap #${replyTarget.tenant_id}`}
              {replyTarget.User ? ` · ${replyTarget.User.full_name}` : ''}
            </Typography.Paragraph>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {replyTarget.message}
              </Typography.Paragraph>
            </Card>
            {!!replyTarget.Attachments?.length && (
              <Space direction="vertical" size={4} style={{ marginBottom: 16, width: '100%' }}>
                <Typography.Text strong>Ekler</Typography.Text>
                {replyTarget.Attachments.map((att) => (
                  <Space key={att.id} wrap>
                    <PaperClipOutlined />
                    <span>
                      {att.original_name} ({formatFileSize(att.size_bytes)})
                    </span>
                    {isPdfAttachment(att) && (
                      <Button
                        size="small"
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => void openAttachment(att, 'view')}
                      >
                        Görüntüle
                      </Button>
                    )}
                    <Button
                      size="small"
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() => void openAttachment(att, 'download')}
                    >
                      İndir
                    </Button>
                  </Space>
                ))}
              </Space>
            )}
            <Form form={replyForm} layout="vertical" onFinish={submitReply}>
              <Form.Item name="status" label="Durum" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'new', label: FEEDBACK_STATUS_LABEL.new.text },
                    { value: 'read', label: FEEDBACK_STATUS_LABEL.read.text },
                    { value: 'resolved', label: FEEDBACK_STATUS_LABEL.resolved.text },
                    { value: 'cancelled', label: FEEDBACK_STATUS_LABEL.cancelled.text },
                  ]}
                />
              </Form.Item>
              <Form.Item name="reply" label="Cevabınız" rules={[{ max: 2000 }]}>
                <Input.TextArea rows={4} maxLength={2000} showCount placeholder="Kullanıcıya iletilecek cevap..." />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}
