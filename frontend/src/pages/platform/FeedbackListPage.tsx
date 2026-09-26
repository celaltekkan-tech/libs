import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { AppLayout } from '../../components/AppLayout'
import { FeedbackUpdatesBlock, FeedbackThreadBody } from '../../components/FeedbackUpdatesBlock'
import { FeedbackMessageHtml, RichTextEditor, sanitizeFeedbackHtml, stripHtml } from '../../components/RichTextEditor'
import {
  addFeedbackUpdate,
  deleteFeedback,
  downloadFeedbackAttachment,
  getFeedbackSyncStatus,
  listFeedback,
  runFeedbackSync,
  updateFeedback,
  viewFeedbackAttachment,
} from '../../api/feedback'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import {
  FEEDBACK_FILTER_OPTIONS,
  FEEDBACK_STATUS_LABEL,
  OPEN_FEEDBACK_STATUSES,
  feedbackAuthorLabel,
  feedbackOriginLabel,
  feedbackTenantLabel,
  formatFileSize,
  isPdfAttachment,
  type Feedback,
  type FeedbackAttachment,
  type FeedbackStatus,
  type FeedbackStatusFilter,
  type FeedbackSyncStatus,
} from '../../types/feedback'
import type { TenantListItem } from '../../types/tenant'
import { TypedPhraseConfirmModal } from '../../components/TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../../hooks/useBulkTypedDelete'

const { RangePicker } = DatePicker

export function FeedbackListPage() {
  const { message, modal } = App.useApp()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('new')
  const [tenantFilter, setTenantFilter] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null)
  const [replyForm] = Form.useForm<{ status: FeedbackStatus; body: string }>()
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [syncStatus, setSyncStatus] = useState<FeedbackSyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  const refreshSyncStatus = useCallback(async () => {
    try {
      setSyncStatus(await getFeedbackSyncStatus())
    } catch {
      setSyncStatus(null)
    }
  }, [])

  useEffect(() => {
    void refreshSyncStatus()
  }, [refreshSyncStatus])

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

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => feedbacks.map((f) => f.id),
    deleteOne: (id) => deleteFeedback(Number(id)),
    noun: 'geri bildirim',
    reload: () => void load(),
    message,
  })

  const runSync = async () => {
    setSyncing(true)
    try {
      const result = await runFeedbackSync()
      setSyncStatus((prev) => ({
        enabled: result.enabled,
        env: result.env,
        peer_configured: prev?.peer_configured ?? result.enabled,
        last_run_at: new Date().toISOString(),
        last_success_at: result.ok ? new Date().toISOString() : prev?.last_success_at ?? null,
        last_error: result.ok ? null : result.error || 'Senkron başarısız',
        last_summary: result.last_summary ?? prev?.last_summary ?? null,
      }))
      if (result.ok) {
        message.success('Geri bildirimler senkronize edildi')
        void load()
      } else {
        message.warning(result.error || 'Senkron tamamlanamadı')
      }
      void refreshSyncStatus()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

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
      status: record.status === 'new' ? 'read' : record.status,
      body: '',
    })
  }

  const submitReply = async (values: { status: FeedbackStatus; body: string }) => {
    if (!replyTarget) return
    const html = values.body ? sanitizeFeedbackHtml(values.body) : ''
    const hasBody = stripHtml(html).length >= 3
    setReplySubmitting(true)
    try {
      if (hasBody) {
        await addFeedbackUpdate(replyTarget.id, html)
      }
      if (values.status !== replyTarget.status) {
        await updateFeedback(replyTarget.id, { status: values.status })
      } else if (!hasBody) {
        message.warning('Durum değişmedi ve gelişme metni girilmedi')
        return
      }
      message.success(hasBody ? 'Gelişme eklendi' : 'Durum güncellendi')
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
      <div style={{ width: '100%' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Geri Bildirimler
            </Typography.Title>
            <Typography.Text type="secondary">
              Tenant hesaplarından gelen mesajları filtreleyin, yanıtlayın ve ekleri inceleyin.
              {syncStatus?.last_success_at
                ? ` Son senkron: ${new Date(syncStatus.last_success_at).toLocaleString('tr-TR')}.`
                : ''}
            </Typography.Text>
            {syncStatus?.last_error ? (
              <div>
                <Typography.Text type="danger">{syncStatus.last_error}</Typography.Text>
              </div>
            ) : null}
          </div>

          <Card size="small" styles={{ body: { padding: 12 } }}>
            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
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
              <Space>
                <Tooltip
                  title={
                    syncStatus && !syncStatus.enabled
                      ? 'Karşı ortam adresi ve paylaşılan anahtar tanımlı değil'
                      : 'Karşı ortamdaki geri bildirimleri alır, buradaki değişiklikleri yazar'
                  }
                >
                  <span>
                    <Button
                      icon={<SyncOutlined />}
                      loading={syncing}
                      disabled={syncStatus != null && !syncStatus.enabled}
                      onClick={() => void runSync()}
                    >
                      Senkronize et
                    </Button>
                  </span>
                </Tooltip>
                {!loading && feedbacks.length > 0 && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                    Toplu sil ({feedbacks.length})
                  </Button>
                )}
              </Space>
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
                defaultPageSize: 10,
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
                            <Space size={8} wrap>
                              <Typography.Text type="secondary" copyable={{ text: String(item.id) }}>
                                #{item.id}
                              </Typography.Text>
                              <Typography.Text strong style={{ fontSize: 15 }}>
                                {feedbackTenantLabel(item)}
                              </Typography.Text>
                              {feedbackOriginLabel(item.origin_env) && (
                                <Tag>{feedbackOriginLabel(item.origin_env)}</Tag>
                              )}
                            </Space>
                            <Typography.Text type="secondary">
                              {feedbackAuthorLabel(item)}
                              {' · '}
                              {new Date(item.created_at).toLocaleString('tr-TR')}
                              {item.page_title || item.page_path
                                ? ` · ${item.page_title || item.page_path}`
                                : ''}
                            </Typography.Text>
                          </Space>
                          <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
                        </Space>

                        <FeedbackMessageHtml html={item.message} />

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

                        <FeedbackUpdatesBlock item={item} />

                        <Space wrap>
                          {OPEN_FEEDBACK_STATUSES.includes(item.status) && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openReply(item)}>
                              Gelişme ekle
                            </Button>
                          )}
                          {item.status !== 'read' && OPEN_FEEDBACK_STATUSES.includes(item.status) && (
                            <Button icon={<EyeOutlined />} onClick={() => void changeStatus(item.id, 'read')}>
                              İnceleniyor
                            </Button>
                          )}
                          {item.status !== 'waiting' && OPEN_FEEDBACK_STATUSES.includes(item.status) && (
                            <Button onClick={() => void changeStatus(item.id, 'waiting')}>Beklemede</Button>
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
        title="Gelişme ekle"
        open={!!replyTarget}
        onCancel={() => setReplyTarget(null)}
        onOk={() => replyForm.submit()}
        confirmLoading={replySubmitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
        width={560}
      >
        {replyTarget && (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {feedbackTenantLabel(replyTarget)}
              {replyTarget.User?.full_name || replyTarget.author_name
                ? ` · ${replyTarget.User?.full_name || replyTarget.author_name}`
                : ''}
            </Typography.Paragraph>
            <div style={{ marginBottom: 16, maxHeight: 280, overflow: 'auto' }}>
              <FeedbackThreadBody item={replyTarget} />
            </div>
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
                    { value: 'waiting', label: FEEDBACK_STATUS_LABEL.waiting.text },
                    { value: 'resolved', label: FEEDBACK_STATUS_LABEL.resolved.text },
                    { value: 'cancelled', label: FEEDBACK_STATUS_LABEL.cancelled.text },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="body"
                label="Yeni gelişme"
                rules={[
                  {
                    validator: async (_, value) => {
                      if ((value || '').length > 10000) throw new Error('Metin çok uzun')
                    },
                  },
                ]}
              >
                <RichTextEditor
                  minHeight={120}
                  placeholder="Kullanıcıya iletilecek gelişme… (boş bırakıp yalnızca durum da güncelleyebilirsiniz)"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Geri bildirimleri toplu sil"
        description={`Filtreye uyan ${feedbacks.length} geri bildirim silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
