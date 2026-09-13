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
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd'
import {
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  InboxOutlined,
  PaperClipOutlined,
  SendOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { AppLayout } from '../components/AppLayout'
import { FeedbackMessageHtml, RichTextEditor, sanitizeFeedbackHtml, stripHtml } from '../components/RichTextEditor'
import {
  cancelFeedback,
  downloadFeedbackAttachment,
  listMyFeedback,
  submitFeedback,
  viewFeedbackAttachment,
} from '../api/feedback'
import { getErrorMessage } from '../api/client'
import {
  FEEDBACK_ACCEPT,
  FEEDBACK_FILTER_OPTIONS,
  FEEDBACK_STATUS_LABEL,
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
  type Feedback,
  type FeedbackAttachment,
  type FeedbackStatusFilter,
} from '../types/feedback'

const { RangePicker } = DatePicker

const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|png|jpe?g|gif|webp)$/i
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES = 5

export function FeedbackPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ message: string }>()
  const [cancelForm] = Form.useForm<{ reason: string }>()
  const [submitting, setSubmitting] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('all')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [cancelTarget, setCancelTarget] = useState<Feedback | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFeedbacks(
        await listMyFeedback({
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(dateRange?.[0] ? { from: dateRange[0].format('YYYY-MM-DD') } : {}),
          ...(dateRange?.[1] ? { to: dateRange[1].format('YYYY-MM-DD') } : {}),
        }),
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, statusFilter, dateRange])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async (values: { message: string }) => {
    const html = sanitizeFeedbackHtml(values.message || '')
    if (stripHtml(html).length < 5) {
      message.error('Mesaj en az 5 karakter olmalı')
      return
    }
    setSubmitting(true)
    try {
      const files = fileList
        .map((f) => f.originFileObj)
        .filter((f): f is RcFile => Boolean(f))
      await submitFeedback(html, files)
      message.success('Geri bildiriminiz gönderildi, teşekkürler')
      form.resetFields()
      setFileList([])
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openAttachment = async (att: FeedbackAttachment, mode: 'view' | 'download') => {
    try {
      if (mode === 'view' && (isPdfAttachment(att) || isImageAttachment(att))) {
        await viewFeedbackAttachment(att.id, att.original_name, true)
      } else {
        await downloadFeedbackAttachment(att.id, att.original_name)
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onCancelFeedback = (item: Feedback) => {
    cancelForm.resetFields()
    setCancelTarget(item)
  }

  const submitCancelFeedback = async () => {
    if (!cancelTarget) return
    try {
      const { reason } = await cancelForm.validateFields()
      setCancelSubmitting(true)
      await cancelFeedback(cancelTarget.id, reason)
      message.success('Geri bildirim iptal edildi')
      setCancelTarget(null)
      void load()
    } catch (err) {
      if (err instanceof Error) message.error(getErrorMessage(err))
    } finally {
      setCancelSubmitting(false)
    }
  }

  const addImageFile = (blob: File) => {
    if (blob.size > MAX_FILE_SIZE) {
      message.error('Ekran görüntüsü en fazla 5 MB olabilir')
      return
    }
    if (fileList.length >= MAX_FILES) {
      message.error(`En fazla ${MAX_FILES} dosya ekleyebilirsiniz`)
      return
    }
    const ext = blob.type.split('/')[1] || 'png'
    const uid = `paste-${Date.now()}`
    const file = new File([blob], `ekran-goruntusu-${Date.now()}.${ext}`, { type: blob.type }) as RcFile
    file.uid = uid
    setFileList((prev) =>
      [
        ...prev,
        {
          uid,
          name: file.name,
          status: 'done' as const,
          size: file.size,
          type: file.type,
          originFileObj: file,
        },
      ].slice(0, MAX_FILES),
    )
    message.success('Ekran görüntüsü eklendi')
  }

  return (
    <AppLayout title="Geri Bildirim">
      <div style={{ maxWidth: 720 }}>
        <Typography.Title level={3}>Geri Bildirim Gönder</Typography.Title>
        <Typography.Paragraph type="secondary">
          Madde imi, kalın/italik yazı kullanabilirsiniz. İsterseniz PDF veya ekran görüntüsü ekleyin
          (Ctrl+V ile yapıştırabilirsiniz).
        </Typography.Paragraph>

        <Card>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="message"
              label="Mesajınız"
              rules={[
                {
                  validator: async (_, value) => {
                    const plain = stripHtml(value || '')
                    if (plain.length < 5) throw new Error('Mesaj en az 5 karakter olmalı')
                    if ((value || '').length > 10000) throw new Error('Mesaj çok uzun')
                  },
                },
              ]}
            >
              <RichTextEditor
                minHeight={140}
                placeholder="Yazmak istediğiniz geri bildirim… (madde imi için araç çubuğunu kullanın)"
                onImagePaste={addImageFile}
              />
            </Form.Item>
            <Form.Item label="Doküman veya ekran görüntüsü ekle (isteğe bağlı)">
              <Upload.Dragger
                multiple
                accept={FEEDBACK_ACCEPT}
                fileList={fileList}
                listType="picture"
                beforeUpload={(file) => {
                  if (!ALLOWED_EXT.test(file.name)) {
                    message.error('Yalnızca PDF, Ofis dosyaları veya resim yüklenebilir')
                    return Upload.LIST_IGNORE
                  }
                  if (file.size > MAX_FILE_SIZE) {
                    message.error('Dosya boyutu en fazla 5 MB olabilir')
                    return Upload.LIST_IGNORE
                  }
                  return false
                }}
                onChange={({ fileList: next }) => setFileList(next.slice(0, MAX_FILES))}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Dosyayı buraya sürükleyin veya tıklayarak seçin</p>
                <p className="ant-upload-hint">
                  PDF, Word, Excel, PowerPoint, resim (png/jpg/gif/webp) — en fazla {MAX_FILES} dosya, her biri 5 MB
                </p>
              </Upload.Dragger>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
                Gönder
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Typography.Title level={4} style={{ marginTop: 32 }}>
          Gönderdiklerim
        </Typography.Title>

        <Space wrap style={{ marginBottom: 16 }}>
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

        <List
          loading={loading}
          dataSource={feedbacks}
          locale={{ emptyText: <Empty description="Bu filtrelere uygun geri bildirim yok" /> }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
            showTotal: (total) => `Toplam ${total} kayıt`,
            hideOnSinglePage: false,
          }}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <Card style={{ width: '100%' }} size="small">
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text type="secondary">
                      {item.User?.full_name ? `${item.User.full_name} — ` : ''}
                      {new Date(item.created_at).toLocaleString('tr-TR')}
                    </Typography.Text>
                    <Space>
                      <Tag color={FEEDBACK_STATUS_LABEL[item.status].color}>
                        {FEEDBACK_STATUS_LABEL[item.status].text}
                      </Tag>
                      {(item.status === 'new' || item.status === 'read') && (
                        <Button
                          size="small"
                          danger
                          type="link"
                          icon={<CloseCircleOutlined />}
                          onClick={() => onCancelFeedback(item)}
                        >
                          İptal Et
                        </Button>
                      )}
                    </Space>
                  </Space>
                  <FeedbackMessageHtml html={item.message} />
                  {!!item.Attachments?.length && (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {item.Attachments.map((att) => (
                        <Space key={att.id} wrap>
                          <PaperClipOutlined />
                          <Typography.Text>
                            {att.original_name} ({formatFileSize(att.size_bytes)})
                          </Typography.Text>
                          {(isPdfAttachment(att) || isImageAttachment(att)) && (
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
                    <Card size="small" type="inner" title="Yönetici cevabı">
                      <FeedbackMessageHtml html={item.reply} />
                      {item.replied_at && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.replied_at).toLocaleString('tr-TR')}
                        </Typography.Text>
                      )}
                    </Card>
                  )}
                  {item.status === 'cancelled' && item.cancel_reason && (
                    <Card size="small" type="inner" title="İptal nedeni">
                      <Typography.Paragraph style={{ marginBottom: 0 }}>{item.cancel_reason}</Typography.Paragraph>
                    </Card>
                  )}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </div>

      <Modal
        title="Geri bildirimi iptal et"
        open={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onOk={() => void submitCancelFeedback()}
        confirmLoading={cancelSubmitting}
        okText="İptal et"
        okButtonProps={{ danger: true }}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            name="reason"
            label="İptal nedeni"
            rules={[
              { required: true, message: 'Lütfen bir iptal nedeni girin' },
              { min: 3, message: 'İptal nedeni en az 3 karakter olmalı' },
              { max: 500, message: 'İptal nedeni en fazla 500 karakter olabilir' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="Neden iptal ediyorsunuz?" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
