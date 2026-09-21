import { useEffect } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { SANCTION_TYPE_OPTIONS } from '../types/discipline'

interface DisciplineRegulationArticleModalProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: { article_no?: string; title: string; description?: string; default_sanction_type?: string }) => void
}

export function DisciplineRegulationArticleModal({ open, submitting, onCancel, onSubmit }: DisciplineRegulationArticleModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  return (
    <Modal
      title="Yönetmelik Maddesi Ekle"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="article_no" label="Madde No">
          <Input placeholder="Örn: 12/A" />
        </Form.Item>
        <Form.Item name="title" label="Başlık" rules={[{ required: true, message: 'Başlık zorunludur' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Açıklama">
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="default_sanction_type" label="İlişkili Ceza Türü">
          <Select allowClear options={SANCTION_TYPE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
