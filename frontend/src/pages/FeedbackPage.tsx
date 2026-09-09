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
  Segmented,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { DownloadOutlined, EyeOutlined, PaperClipOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { AppLayout } from '../components/AppLayout'
import {
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
  isPdfAttachment,
  type Feedback,
  type FeedbackAttachment,
  type FeedbackStatusFilter,
} from '../types/feedback'

const { RangePicker } = DatePicker

const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp)$/i

export function FeedbackPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ message: string }>()
  const [submitting, setSubmitting] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('all')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

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
    setSubmitting(true)
    try {
      const files = fileList
        .map((f) => f.originFileObj)
        .filter((f): f is RcFile => Boolean(f))
      await submitFeedback(values.message, files)
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
      if (mode === 'view' && isPdfAttachment(att)) {
        await viewFeedbackAttachment(att.id, att.original_name, true)
      } else {
        await downloadFeedbackAttachment(att.id, att.original_name)
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  return (
    <AppLayout title="Geri Bildirim">
      <div style={{ maxWidth: 720 }}>
        <Typography.Title level={3}>Geri Bildirim Gönder</Typography.Title>
        <Typography.Paragraph type="secondary">
          Sistemle ilgili öneri, sorun veya isteklerinizi buradan iletebilirsiniz. İsterseniz PDF veya Ofis
          dosyası ekleyebilirsiniz.
        </Typography.Paragraph>

        <Card>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="message"
              label="Mesajınız"
              rules={[
                { required: true, message: 'Lütfen bir mesaj girin' },
                { min: 5, message: 'Mesaj en az 5 karakter olmalı' },
                { max: 2000, message: 'Mesaj en fazla 2000 karakter olabilir' },
              ]}
            >
              <Input.TextArea rows={6} maxLength={2000} showCount placeholder="Yazmak istediğiniz geri bildirim..." />
            </Form.Item>
            <Form.Item label="Doküman ekle (isteğe bağlı)">
              <Upload
                multiple
                accept={FEEDBACK_ACCEPT}
                fileList={fileList}
                beforeUpload={(file) => {
                  if (!ALLOWED_EXT.test(file.name)) {
                    message.error('Yalnızca PDF ve Ofis dosyaları yüklenebilir')
                    return Upload.LIST_IGNORE
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    message.error('Dosya boyutu en fazla 5 MB olabilir')
                    return Upload.LIST_IGNORE
                  }
                  return false
                }}
                onChange={({ fileList: next }) => setFileList(next.slice(0, 5))}
              >
                <Button icon={<UploadOutlined />}>Dosya seç</Button>
              </Upload>
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                PDF, Word, Excel, PowerPoint — en fazla 5 dosya, her biri 5 MB.
              </Typography.Text>
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
                    <Tag color={FEEDBACK_STATUS_LABEL[item.status].color}>
                      {FEEDBACK_STATUS_LABEL[item.status].text}
                    </Tag>
                  </Space>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{item.message}</Typography.Paragraph>
                  {!!item.Attachments?.length && (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {item.Attachments.map((att) => (
                        <Space key={att.id} wrap>
                          <PaperClipOutlined />
                          <Typography.Text>
                            {att.original_name} ({formatFileSize(att.size_bytes)})
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
                    <Card size="small" type="inner" title="Yönetici cevabı">
                      <Typography.Paragraph style={{ marginBottom: 0 }}>{item.reply}</Typography.Paragraph>
                      {item.replied_at && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.replied_at).toLocaleString('tr-TR')}
                        </Typography.Text>
                      )}
                    </Card>
                  )}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </div>
    </AppLayout>
  )
}
