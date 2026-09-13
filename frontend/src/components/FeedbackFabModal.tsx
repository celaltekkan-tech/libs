import { useState } from 'react'
import { App, Button, Form, Modal, Tooltip, Typography, Upload } from 'antd'
import { CommentOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { submitFeedback } from '../api/feedback'
import { getErrorMessage } from '../api/client'
import { FEEDBACK_ACCEPT } from '../types/feedback'
import { RichTextEditor, sanitizeFeedbackHtml, stripHtml } from './RichTextEditor'

const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|png|jpe?g|gif|webp)$/i
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES = 5

export function FeedbackFabModal() {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [form] = Form.useForm<{ message: string }>()

  const close = () => {
    setOpen(false)
    form.resetFields()
    setFileList([])
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

  const onFinish = async (values: { message: string }) => {
    const html = sanitizeFeedbackHtml(values.message || '')
    const plain = stripHtml(html)
    if (plain.length < 5) {
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
      close()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Tooltip title="Geri bildirim gönder" placement="left">
        <button
          type="button"
          className="feedback-fab"
          aria-label="Geri bildirim gönder"
          onClick={() => setOpen(true)}
        >
          <CommentOutlined />
        </button>
      </Tooltip>

      <Modal
        title="Geri Bildirim Gönder"
        open={open}
        onCancel={close}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Öneri, sorun veya isteklerinizi yazın. Madde imi, kalın yazı gibi biçimlendirme
          kullanabilirsiniz. Dosya veya ekran görüntüsü ekleyebilirsiniz (Ctrl+V).
        </Typography.Paragraph>

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
              placeholder="Yazmak istediğiniz geri bildirim… (madde imi için araç çubuğunu kullanın)"
              onImagePaste={addImageFile}
            />
          </Form.Item>

          <Form.Item label="Dosya ekle (isteğe bağlı)">
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
              <p className="ant-upload-hint">PDF, Ofis, resim — en fazla {MAX_FILES} dosya, her biri 5 MB</p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={close} style={{ marginRight: 8 }}>
              Vazgeç
            </Button>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
              Gönder
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
