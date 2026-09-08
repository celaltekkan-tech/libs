import { useState } from 'react'
import { App, Button, Card, Form, Input, Layout, Typography } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { AppHeader } from '../components/AppHeader'
import { submitFeedback } from '../api/feedback'
import { getErrorMessage } from '../api/client'

export function FeedbackPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ message: string }>()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values: { message: string }) => {
    setSubmitting(true)
    try {
      await submitFeedback(values.message)
      message.success('Geri bildiriminiz gönderildi, teşekkürler')
      form.resetFields()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="app-shell">
      <AppHeader title="Geri Bildirim" />

      <Layout.Content className="app-content" style={{ maxWidth: 640 }}>
        <Typography.Title level={3}>Geri Bildirim Gönder</Typography.Title>
        <Typography.Paragraph type="secondary">
          Sistemle ilgili öneri, sorun veya isteklerinizi buradan iletebilirsiniz.
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
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
                Gönder
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Layout.Content>
    </Layout>
  )
}
